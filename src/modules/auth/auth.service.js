import pool from "../../database/db.js"
import bcrypt from "bcryptjs"
import generateToken from "../../utils/generateToken.js"
import crypto from "crypto"

/* =========================================
   LOGIN USER (PRO VERSION - STABLE)
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

  if (!user) {
    throw new Error("Credenciales inválidas")
  }

  if (!user.is_active) {
    throw new Error("Cuenta deshabilitada. Contacte al administrador.")
  }

  // Solo validar empresa si pertenece a una
  if (user.company_id && user.company_active === false) {
    throw new Error("Empresa deshabilitada. Contacte al administrador.")
  }

  const isMatch = await bcrypt.compare(cleanPassword, user.password_hash)

  if (!isMatch) {
    throw new Error("Credenciales inválidas")
  }

  // 🔐 Nueva sesión única
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

  const token = generateToken({
    id: user.id,
    role: user.role,
    company_id: user.company_id,
    session_id: sessionId
  })
console.log("USANDO AUTH SERVICE NUEVO 🚀")
  return {
    token,
    must_change_password: Boolean(user.must_change_password),
    user: {
      id: user.id,
      name: user.first_name,
      role: user.role,
      company_id: user.company_id || null,
      company_name: user.company_name || null
    }
  }
}


/* =========================================
   UPDATE PASSWORD (FORCED CHANGE SAFE)
========================================= */
export const updatePassword = async (userId, newPassword) => {

  if (!newPassword || newPassword.trim().length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres")
  }

  const hashedPassword = await bcrypt.hash(newPassword.trim(), 10)

  await pool.query(
    `
    UPDATE public.users
    SET password_hash = $1,
        must_change_password = false
    WHERE id = $2
    `,
    [hashedPassword, userId]
  )

  return true
}