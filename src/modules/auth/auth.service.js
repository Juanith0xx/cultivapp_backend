import pool from "../../database/db.js"
import bcrypt from "bcryptjs"
import generateToken from "../../utils/generateToken.js"
import crypto from "crypto"
import { logAction } from "../../utils/audit.js"

/* =========================================
   LOGIN USER (SaaS PRO - MULTI-TENANT)
========================================= */
export const loginUser = async ({ email, password }) => {

  if (!email || !password) {
    throw new Error("Credenciales inválidas")
  }

  const normalizedEmail = email.trim().toLowerCase()
  const cleanPassword = password.trim()

  const result = await pool.query(
    `
    SELECT 
      u.id,
      u.first_name,
      u.last_name,   -- 🚩 Añadido: Faltaba pedir el apellido a la BD
      u.email,
      u.password_hash,
      u.role,
      u.company_id,
      u.is_active,
      u.must_change_password,
      c.is_active AS company_active,
      c.name AS company_name
    FROM public.users u
    LEFT JOIN public.companies c 
      ON u.company_id = c.id
    WHERE LOWER(u.email) = $1
    `,
    [normalizedEmail]
  )

  const user = result.rows[0]

  // 1. Validaciones de Seguridad
  if (!user) throw new Error("Credenciales inválidas")
  if (!user.is_active) throw new Error("Cuenta deshabilitada")

  // Validación Multi-tenant: Si el usuario tiene empresa, la empresa debe estar activa
  if (user.company_id && user.company_active === false) {
    throw new Error("La empresa asociada se encuentra deshabilitada")
  }

  const isMatch = await bcrypt.compare(cleanPassword, user.password_hash)
  if (!isMatch) throw new Error("Credenciales inválidas")

  // 2. Gestión de Sesión Única
  const sessionId = crypto.randomUUID()

  await pool.query(
    `
    UPDATE public.users 
    SET session_id = $1,
        last_login = NOW()
    WHERE id = $2
    `,
    [sessionId, user.id]
  )

  // 3. Auditoría de Acceso
  await logAction(user.id, "LOGIN")

  // 4. Generación de Token con Payload Completo
  const tokenPayload = {
    sub: user.id,           
    id: user.id,            
    company_id: user.company_id, 
    session_id: sessionId,
    role: user.role,
    aud: 'authenticated'
  };

  const token = generateToken(tokenPayload)

  // 5. Respuesta al Cliente
  return {
    token,
    must_change_password: Boolean(user.must_change_password),
    user: {
      id: user.id,
      name: user.first_name, // Lo mantenemos por si algún otro componente lo usa
      first_name: user.first_name, // 🚩 Añadido para el perfil de usuario
      last_name: user.last_name,   // 🚩 Añadido para el perfil de usuario y avatar
      email: user.email,           // 🚩 Añadido el email por buena práctica
      role: user.role,
      company_id: user.company_id,
      company_name: user.company_name || 'Sin Empresa'
    }
  }
}

/* =========================================
   UPDATE PASSWORD (AUTHENTICATED)
========================================= */
export const updatePassword = async (userId, newPassword) => {
  if (!newPassword || newPassword.trim().length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres")
  }

  const hashedPassword = await bcrypt.hash(newPassword.trim(), 10)

  // Al cambiar contraseña invalidamos la sesión actual (security best practice)
  await pool.query(
    `
    UPDATE public.users
    SET password_hash = $1,
        must_change_password = false,
        session_id = NULL 
    WHERE id = $2
    `,
    [hashedPassword, userId]
  )

  await logAction(userId, "CHANGE_PASSWORD")
  return true
}