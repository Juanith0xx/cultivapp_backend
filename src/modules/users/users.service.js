import db from "../../database/db.js"
import bcrypt from "bcryptjs"
import crypto from "crypto"

/* =========================================================
   HELPER: HASH PASSWORD
========================================================= */
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10)
}

/* =========================================================
   HELPER: GENERATE TEMP PASSWORD
========================================================= */
const generateTempPassword = () => {
  return crypto
    .randomBytes(6)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .slice(0, 10)
}

/* =========================================================
   GET PUBLIC USER INFO
========================================================= */
export const getPublicUserInfo = async (id) => {
  const result = await db.query(
    `SELECT 
      id, first_name, last_name, rut, position, foto_url, 
      fecha_contrato, tipo_contrato, achs_url, is_active, 
      supervisor_nombre, supervisor_telefono
     FROM public.users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  return result.rows[0]
}

/* =========================================================
   GET USER BY ID
========================================================= */
export const getUserById = async (id) => {
  const result = await db.query(
    `SELECT 
      id, company_id, first_name, last_name, email, role, 
      is_active, phone, position, rut, foto_url, achs_url, tipo_contrato,
      fecha_contrato, supervisor_nombre, supervisor_telefono
     FROM public.users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  return result.rows[0]
}

/* =========================================================
   CREATE USER
========================================================= */
export const createUser = async ({
  first_name,
  last_name,
  email,
  password,
  role,
  company_id,
  phone,
  position,
  rut,
  foto_url,
  achs_url,
  tipo_contrato,
  fecha_contrato,
  supervisor_nombre,
  supervisor_telefono
}) => {
  if (!first_name || !email || !password || !role || !company_id) {
    throw new Error("Faltan campos obligatorios")
  }

  // Validación de correos duplicados
  const emailExists = await db.query(
    `SELECT id FROM public.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
    [email]
  )
  if (emailExists.rows.length > 0) throw new Error("El correo ya está registrado")

  // Validación de límites de la empresa (SaaS logic)
  const companyResult = await db.query(
    `SELECT max_supervisors, max_users, max_view, is_active FROM public.companies WHERE id = $1 AND deleted_at IS NULL`,
    [company_id]
  )
  if (companyResult.rows.length === 0) throw new Error("Empresa no encontrada")
  if (!companyResult.rows[0].is_active) throw new Error("Empresa inactiva")

  const company = companyResult.rows[0]
  const countResult = await db.query(
    `SELECT COUNT(*) FROM public.users WHERE company_id = $1 AND role = $2 AND is_active = true AND deleted_at IS NULL`,
    [company_id, role]
  )
  const currentCount = parseInt(countResult.rows[0].count)

  if (role === "SUPERVISOR" && currentCount >= company.max_supervisors) throw new Error("Límite de supervisores alcanzado")
  if (role === "USUARIO" && currentCount >= company.max_users) throw new Error("Límite de usuarios alcanzado")
  if (role === "VIEW" && currentCount >= company.max_view) throw new Error("Límite de usuarios solo vista alcanzado")

  const hashedPassword = await hashPassword(password)

  // Inserción con nuevos campos de credencial y SaaS
  const result = await db.query(
    `INSERT INTO public.users
     (company_id, first_name, last_name, email, password_hash, role, is_active, 
      must_change_password, phone, position, rut, foto_url, achs_url, 
      tipo_contrato, fecha_contrato, supervisor_nombre, supervisor_telefono)
     VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id, first_name, last_name, email, role, company_id`,
    [
      company_id, first_name, last_name, email, hashedPassword, role,
      phone, position, rut, foto_url, achs_url, 
      tipo_contrato || 'Plazo Fijo', fecha_contrato || null, 
      supervisor_nombre, supervisor_telefono
    ]
  )

  return result.rows[0]
}

/* =========================================================
   UPDATE USER
========================================================= */
export const updateUser = async (id, data) => {
  const existingUser = await getUserById(id)
  if (!existingUser) throw new Error("Usuario no encontrado")
  if (existingUser.role === "ROOT") throw new Error("No se puede editar ROOT")

  const result = await db.query(
    `UPDATE public.users
     SET
       first_name = COALESCE($1, first_name),
       last_name = COALESCE($2, last_name),
       email = COALESCE($3, email),
       role = COALESCE($4, role),
       phone = COALESCE($5, phone),
       position = COALESCE($6, position),
       rut = COALESCE($7, rut),
       foto_url = COALESCE($8, foto_url),
       achs_url = COALESCE($9, achs_url),
       tipo_contrato = COALESCE($10, tipo_contrato),
       fecha_contrato = $11, -- Se permite null para contratos indefinidos
       supervisor_nombre = COALESCE($12, supervisor_nombre),
       supervisor_telefono = COALESCE($13, supervisor_telefono),
       updated_at = NOW()
     WHERE id = $14 AND deleted_at IS NULL
     RETURNING id, first_name, last_name, email, role, is_active, company_id`,
    [
      data.first_name || null,
      data.last_name || null,
      data.email || null,
      data.role || null,
      data.phone || null,
      data.position || null,
      data.rut || null,
      data.foto_url || null,
      data.achs_url || null,
      data.tipo_contrato || null,
      data.fecha_contrato, // Pasamos directo para permitir renovaciones o dejarlo null
      data.supervisor_nombre || null,
      data.supervisor_telefono || null,
      id
    ]
  )

  return result.rows[0]
}

/* =========================================================
   GET USERS (Sincronizado con tabla Admin)
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

  if (company_id) {
    values.push(company_id)
    query += ` AND u.company_id = $${values.length}`
  }

  query += ` ORDER BY u.created_at DESC`

  const result = await db.query(query, values)
  return result.rows
}

/* =========================================================
   RESTO DE FUNCIONES (Toggle, Delete, Reset, Stats)
========================================================= */
export const toggleUser = async (id) => {
  const user = await getUserById(id)
  if (!user) throw new Error("Usuario no encontrado")
  const result = await db.query(
    `UPDATE public.users SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active`, [id]
  )
  return result.rows[0]
}

export const deleteUser = async (id) => {
  await db.query(`UPDATE public.users SET deleted_at = NOW(), session_id = NULL WHERE id = $1`, [id])
  return { message: "Usuario eliminado" }
}

export const resetPassword = async (id) => {
  const temporaryPassword = generateTempPassword()
  const hashedPassword = await hashPassword(temporaryPassword)
  await db.query(`UPDATE public.users SET password_hash = $1, must_change_password = true WHERE id = $2`, [hashedPassword, id])
  return { temporaryPassword }
}

export const getCompanyStats = async (company_id) => {
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