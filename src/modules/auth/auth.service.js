import pool from "../../database/db.js"
import bcrypt from "bcryptjs"
import generateToken from "../../utils/generateToken.js"
import crypto from "crypto"
import { logAction } from "../../utils/audit.js"

/* =========================================
   LOGIN USER (PRO VERSION - AUDITED)
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

  if (!user) throw new Error("Credenciales inválidas")
  if (!user.is_active) throw new Error("Cuenta deshabilitada")

  if (user.company_id && user.company_active === false) {
    throw new Error("Empresa deshabilitada")
  }

  const isMatch = await bcrypt.compare(cleanPassword, user.password_hash)
  if (!isMatch) throw new Error("Credenciales inválidas")

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

  // ✅ AUDITORÍA LOGIN
  await logAction(user.id, "LOGIN")

  // 🚩 MEJORA DEFINITIVA PARA SUPABASE REALTIME
  // Incluimos 'sub' para que Supabase llene correctamente auth.uid()
  const token = generateToken({
    sub: user.id,           
    id: user.id,            
    company_id: user.company_id,
    session_id: sessionId,
    aud: 'authenticated',   
    role: 'authenticated', 
    app_role: user.role 
  })

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
   UPDATE PASSWORD (AUTHENTICATED)
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
        must_change_password = false,
        session_id = NULL
    WHERE id = $2
    `,
    [hashedPassword, userId]
  )

  // ✅ AUDITORÍA CAMBIO CONTRASEÑA
  await logAction(userId, "CHANGE_PASSWORD")

  return true
}

/* =========================================
   CREATE PASSWORD RESET TOKEN (SaaS PRO)
========================================= */
export const createPasswordResetToken = async (email) => {

  const normalizedEmail = email.trim().toLowerCase()

  const userResult = await pool.query(
    `SELECT id FROM public.users WHERE LOWER(email) = $1`,
    [normalizedEmail]
  )

  if (userResult.rows.length === 0) {
    return null
  }

  const user = userResult.rows[0]

  const token = crypto.randomBytes(32).toString("hex")

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex")

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  // Invalidar tokens anteriores
  await pool.query(
    `UPDATE public.password_resets
     SET used = true
     WHERE user_id = $1 AND used = false`,
    [user.id]
  )

  await pool.query(
    `INSERT INTO public.password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  )

  // ✅ AUDITORÍA SOLICITUD RESET
  await logAction(user.id, "REQUEST_PASSWORD_RESET")

  return { token }
}

/* =========================================
   RESET PASSWORD WITH TOKEN
========================================= */
export const resetPasswordWithToken = async (token, newPassword) => {

  if (!token || !newPassword) {
    throw new Error("Datos inválidos")
  }

  if (newPassword.trim().length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres")
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex")

  const result = await pool.query(
    `
    SELECT *
    FROM public.password_resets
    WHERE token_hash = $1
      AND used = false
      AND expires_at > NOW()
    `,
    [tokenHash]
  )

  const resetRecord = result.rows[0]

  if (!resetRecord) {
    throw new Error("Token inválido o expirado")
  }

  const hashedPassword = await bcrypt.hash(newPassword.trim(), 10)

  await pool.query(
    `
    UPDATE public.users
    SET password_hash = $1,
        must_change_password = false,
        session_id = NULL
    WHERE id = $2
    `,
    [hashedPassword, resetRecord.user_id]
  )

  await pool.query(
    `
    UPDATE public.password_resets
    SET used = true
    WHERE id = $1
    `,
    [resetRecord.id]
  )

  // ✅ AUDITORÍA RESET COMPLETADO
  await logAction(resetRecord.user_id, "RESET_PASSWORD")

  return true
}