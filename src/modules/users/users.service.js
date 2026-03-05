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
   GET USER BY ID (SOFT DELETE SAFE)
========================================================= */
export const getUserById = async (id) => {

  const result = await db.query(
    `SELECT id, company_id, role, is_active
     FROM public.users
     WHERE id = $1
       AND deleted_at IS NULL`,
    [id]
  )

  return result.rows[0]
}

/* =========================================================
   CREATE USER
========================================================= */
export const createUser = async ({
  first_name,
  email,
  password,
  role,
  company_id
}) => {

  if (!first_name || !email || !password || !role || !company_id) {
    throw new Error("Faltan campos obligatorios")
  }

  if (role === "ROOT" || role === "ADMIN_CLIENTE") {
    throw new Error("Perfil no permitido")
  }

  const emailExists = await db.query(
    `SELECT id FROM public.users 
     WHERE LOWER(email) = LOWER($1)
       AND deleted_at IS NULL`,
    [email]
  )

  if (emailExists.rows.length > 0) {
    throw new Error("El correo ya está registrado")
  }

  const companyResult = await db.query(
    `SELECT max_supervisors, max_users, max_view, is_active
     FROM public.companies
     WHERE id = $1
       AND deleted_at IS NULL`,
    [company_id]
  )

  if (companyResult.rows.length === 0) {
    throw new Error("Empresa no encontrada")
  }

  const company = companyResult.rows[0]

  if (!company.is_active) {
    throw new Error("Empresa inactiva")
  }

  const countResult = await db.query(
    `SELECT COUNT(*)
     FROM public.users
     WHERE company_id = $1
       AND role = $2
       AND is_active = true
       AND deleted_at IS NULL`,
    [company_id, role]
  )

  const currentCount = parseInt(countResult.rows[0].count)

  if (role === "SUPERVISOR" && currentCount >= company.max_supervisors) {
    throw new Error("Límite de supervisores alcanzado")
  }

  if (role === "USUARIO" && currentCount >= company.max_users) {
    throw new Error("Límite de usuarios alcanzado")
  }

  if (role === "VIEW" && currentCount >= company.max_view) {
    throw new Error("Límite de usuarios solo vista alcanzado")
  }

  const hashedPassword = await hashPassword(password)

  const result = await db.query(
    `INSERT INTO public.users
     (company_id, first_name, email, password_hash, role, is_active, must_change_password)
     VALUES ($1,$2,$3,$4,$5,true,false)
     RETURNING id, first_name, email, role, is_active, company_id`,
    [company_id, first_name, email, hashedPassword, role]
  )

  return result.rows[0]
}

/* =========================================================
   UPDATE USER
========================================================= */
export const updateUser = async (id, { first_name, email, role }) => {

  const existingUser = await getUserById(id)

  if (!existingUser) {
    throw new Error("Usuario no encontrado")
  }

  if (existingUser.role === "ROOT") {
    throw new Error("No se puede editar ROOT")
  }

  const result = await db.query(
    `UPDATE public.users
     SET
       first_name = COALESCE($1, first_name),
       email = COALESCE($2, email),
       role = COALESCE($3, role)
     WHERE id = $4
       AND deleted_at IS NULL
     RETURNING id, first_name, email, role, is_active, company_id`,
    [
      first_name || null,
      email || null,
      role || null,
      id
    ]
  )

  return result.rows[0]
}

/* =========================================================
   TOGGLE USER
========================================================= */
export const toggleUser = async (id) => {

  const user = await getUserById(id)

  if (!user) {
    throw new Error("Usuario no encontrado")
  }

  if (user.role === "ROOT") {
    throw new Error("No se puede modificar ROOT")
  }

  const result = await db.query(
    `UPDATE public.users
     SET is_active = NOT is_active
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, first_name, email, role, is_active, company_id`,
    [id]
  )

  return result.rows[0]
}

/* =========================================================
   SOFT DELETE USER
========================================================= */
export const deleteUser = async (id) => {

  const user = await getUserById(id)

  if (!user) {
    throw new Error("Usuario no encontrado")
  }

  if (user.role === "ROOT") {
    throw new Error("No se puede eliminar ROOT")
  }

  await db.query(
    `UPDATE public.users
     SET deleted_at = NOW(),
         session_id = NULL
     WHERE id = $1`,
    [id]
  )

  return { message: "Usuario eliminado correctamente" }
}

/* =========================================================
   RESET PASSWORD
========================================================= */
export const resetPassword = async (id) => {

  const user = await getUserById(id)

  if (!user) {
    throw new Error("Usuario no encontrado")
  }

  if (user.role === "ROOT") {
    throw new Error("No se puede resetear usuario ROOT")
  }

  const temporaryPassword = generateTempPassword()

  const hashedPassword = await hashPassword(temporaryPassword)

  await db.query(
    `UPDATE public.users
     SET password_hash = $1,
         must_change_password = true
     WHERE id = $2
       AND deleted_at IS NULL`,
    [hashedPassword, id]
  )

  return {
    temporaryPassword
  }
}

/* =========================================================
   GET USERS
========================================================= */
export const getUsers = async (role, company_id) => {

  let query = `
    SELECT 
      u.id,
      u.first_name,
      u.email,
      u.role,
      u.is_active,
      u.company_id,
      c.name AS company_name
    FROM public.users u
    LEFT JOIN public.companies c 
      ON u.company_id = c.id
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
   COMPANY STATS
========================================================= */
export const getCompanyStats = async (company_id) => {

  const company = await db.query(
    `SELECT max_supervisors, max_users, max_view
     FROM public.companies
     WHERE id = $1
       AND deleted_at IS NULL`,
    [company_id]
  )

  if (company.rows.length === 0) {
    throw new Error("Empresa no encontrada")
  }

  const limits = company.rows[0]

  const countsResult = await db.query(
    `SELECT role, COUNT(*)
     FROM public.users
     WHERE company_id = $1
       AND is_active = true
       AND deleted_at IS NULL
     GROUP BY role`,
    [company_id]
  )

  const counts = {
    SUPERVISOR: 0,
    USUARIO: 0,
    VIEW: 0
  }

  countsResult.rows.forEach(row => {
    counts[row.role] = parseInt(row.count)
  })

  return { counts, limits }
}