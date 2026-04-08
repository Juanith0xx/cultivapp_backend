import db from "../../database/db.js"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10)
}

const generateTempPassword = () => {
  return crypto.randomBytes(6).toString("base64").replace(/[+/=]/g, "").slice(0, 10)
}

/* =========================================================
   GET PUBLIC USER INFO
========================================================= */
export const getPublicUserInfo = async (id) => {
  const result = await db.query(
    `SELECT id, first_name, last_name, rut, position, foto_url, 
      fecha_contrato, tipo_contrato, achs_url, is_active, 
      supervisor_nombre, supervisor_telefono
     FROM public.users WHERE id = $1 AND deleted_at IS NULL`, [id]
  )
  return result.rows[0]
}

/* =========================================================
   GET USER BY ID
========================================================= */
export const getUserById = async (id) => {
  const result = await db.query(
    `SELECT id, company_id, first_name, last_name, email, role, 
      is_active, phone, position, rut, foto_url, achs_url, tipo_contrato,
      fecha_contrato, supervisor_nombre, supervisor_telefono
     FROM public.users WHERE id = $1 AND deleted_at IS NULL`, [id]
  )
  return result.rows[0]
}

/* =========================================================
   CREATE USER (🚩 FIX ROOT COMPATIBILITY)
========================================================= */
export const createUser = async (data) => {
  const { first_name, email, password, role, company_id } = data;

  // 🚩 FIX: Permitimos company_id NULL solo si el rol es ROOT
  if (!first_name || !email || !password || !role) {
    throw new Error("Faltan campos obligatorios");
  }

  if (role !== 'ROOT' && !company_id) {
    throw new Error("El usuario debe estar asignado a una empresa");
  }

  const emailExists = await db.query(
    `SELECT id FROM public.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`, [email]
  )
  if (emailExists.rows.length > 0) throw new Error("El correo ya está registrado")

  // Solo validamos límites si NO es ROOT
  if (role !== 'ROOT') {
    const companyResult = await db.query(
      `SELECT max_supervisors, max_users, max_view, is_active FROM public.companies WHERE id = $1 AND deleted_at IS NULL`, [company_id]
    )
    if (companyResult.rows.length === 0) throw new Error("Empresa no encontrada")
    if (!companyResult.rows[0].is_active) throw new Error("Empresa inactiva")

    const company = companyResult.rows[0]
    const countResult = await db.query(
      `SELECT COUNT(*) FROM public.users WHERE company_id = $1 AND role = $2 AND is_active = true AND deleted_at IS NULL`, [company_id, role]
    )
    const currentCount = parseInt(countResult.rows[0].count)

    if (role === "SUPERVISOR" && currentCount >= company.max_supervisors) throw new Error("Límite alcanzado")
    if (role === "USUARIO" && currentCount >= company.max_users) throw new Error("Límite alcanzado")
    if (role === "VIEW" && currentCount >= company.max_view) throw new Error("Límite alcanzado")
  }

  const hashedPassword = await hashPassword(password)

  const result = await db.query(
    `INSERT INTO public.users
     (company_id, first_name, last_name, email, password_hash, role, is_active, 
      must_change_password, phone, position, rut, foto_url, achs_url, 
      tipo_contrato, fecha_contrato, supervisor_nombre, supervisor_telefono)
     VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id, first_name, last_name, email, role, company_id`,
    [
      company_id || null, data.first_name, data.last_name, email, hashedPassword, role,
      data.phone, data.position, data.rut, data.foto_url, data.achs_url, 
      data.tipo_contrato || 'Plazo Fijo', data.fecha_contrato || null, 
      data.supervisor_nombre, data.supervisor_telefono
    ]
  )
  return result.rows[0]
}

/* =========================================================
   GET USERS (🚩 FIX ROOT GLOBAL VIEW)
========================================================= */
export const getUsers = async (role, company_id) => {
  let query = `
    SELECT 
      u.id, u.first_name, u.last_name, u.email, u.role, u.is_active, 
      u.company_id, u.phone, u.position, u.rut, u.foto_url, u.achs_url,
      u.tipo_contrato, u.fecha_contrato, u.supervisor_nombre, u.supervisor_telefono,
      c.name AS company_name
    FROM public.users u
    LEFT JOIN public.companies c ON u.company_id = c.id
    WHERE u.deleted_at IS NULL
  `
  const values = []

  if (role) {
    values.push(role)
    query += ` AND u.role = $${values.length}`
  }

  // 🚩 FIX: Si company_id llega, filtramos. Si no (ROOT), traemos todo.
  if (company_id) {
    values.push(company_id)
    query += ` AND u.company_id = $${values.length}`
  }

  query += ` ORDER BY u.created_at DESC`
  const result = await db.query(query, values)
  return result.rows
}

/* =========================================================
   GET COMPANY STATS (🚩 FIX ROOT CRASH)
========================================================= */
export const getCompanyStats = async (company_id) => {
  // 🚩 Si no hay company_id (ROOT pidiendo dashboard global sin filtro)
  if (!company_id) {
     return { counts: { SUPERVISOR: 0, USUARIO: 0, VIEW: 0 }, limits: { max_supervisors: 0, max_users: 0, max_view: 0 } };
  }

  const company = await db.query(`SELECT max_supervisors, max_users, max_view FROM public.companies WHERE id = $1`, [company_id])
  if (company.rows.length === 0) throw new Error("Empresa no encontrada")
  
  const limits = company.rows[0]
  const countsResult = await db.query(
    `SELECT role, COUNT(*) FROM public.users WHERE company_id = $1 AND is_active = true AND deleted_at IS NULL GROUP BY role`, [company_id]
  )
  const counts = { SUPERVISOR: 0, USUARIO: 0, VIEW: 0 }
  countsResult.rows.forEach(row => { counts[row.role] = parseInt(row.count) })
  return { counts, limits }
}

/* =========================================================
   OTHERS
========================================================= */
export const toggleUser = async (id) => {
  const result = await db.query(`UPDATE public.users SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active`, [id])
  return result.rows[0]
}

export const deleteUser = async (id) => {
  await db.query(`UPDATE public.users SET deleted_at = NOW() WHERE id = $1`, [id])
  return { message: "Usuario eliminado" }
}

export const resetPassword = async (id) => {
  const temporaryPassword = generateTempPassword()
  const hashedPassword = await hashPassword(temporaryPassword)
  await db.query(`UPDATE public.users SET password_hash = $1, must_change_password = true WHERE id = $2`, [hashedPassword, id])
  return { temporaryPassword }
}