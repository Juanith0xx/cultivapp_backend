import db from "../../database/db.js"
import bcrypt from "bcryptjs"

/* ===============================
   OBTENER EMPRESAS (SOFT SAFE)
=============================== */
export const getCompanies = async () => {

  const result = await db.query(`
    SELECT id, rut, name, address,
           max_supervisors, max_users, max_view,
           is_active, created_at
    FROM public.companies
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `)

  return result.rows
}

/* ===============================
   CREAR EMPRESA + ADMIN
=============================== */
export const createCompanyWithAdmin = async ({
  rut,
  name,
  address,
  max_supervisors,
  max_users,
  max_view,
  admin_name,
  admin_email,
  admin_phone,
  admin_position,
  admin_password
}) => {

  const client = await db.connect()

  try {
    await client.query("BEGIN")

    /* ===============================
       VALIDAR RUT (SOFT SAFE)
    =============================== */
    const rutExists = await client.query(
      `SELECT id 
       FROM public.companies 
       WHERE rut = $1
         AND deleted_at IS NULL`,
      [rut]
    )

    if (rutExists.rows.length > 0) {
      throw new Error("El RUT ya está registrado")
    }

    /* ===============================
       VALIDAR EMAIL ADMIN (SOFT SAFE)
    =============================== */
    const emailExists = await client.query(
      `SELECT id 
       FROM public.users 
       WHERE LOWER(email) = LOWER($1)
         AND deleted_at IS NULL`,
      [admin_email]
    )

    if (emailExists.rows.length > 0) {
      throw new Error("El correo del administrador ya existe")
    }

    /* ===============================
       CREAR EMPRESA
    =============================== */
    const companyResult = await client.query(
      `
      INSERT INTO public.companies (
        rut,
        name,
        address,
        max_supervisors,
        max_users,
        max_view
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
      `,
      [
        rut.trim(),
        name.trim(),
        address.trim(),
        max_supervisors || 0,
        max_users || 0,
        max_view || 0
      ]
    )

    const company_id = companyResult.rows[0].id

    /* ===============================
       CREAR ADMIN CLIENTE
    =============================== */
    const hashedPassword = await bcrypt.hash(admin_password.trim(), 10)

    await client.query(
      `
      INSERT INTO public.users (
        company_id,
        first_name,
        email,
        password_hash,
        role,
        is_active,
        phone,
        position
      )
      VALUES ($1,$2,$3,$4,'ADMIN_CLIENTE',true,$5,$6)
      `,
      [
        company_id,
        admin_name.trim(),
        admin_email.trim().toLowerCase(),
        hashedPassword,
        admin_phone ? admin_phone.trim() : null,
        admin_position ? admin_position.trim() : null
      ]
    )

    await client.query("COMMIT")

    return { message: "Empresa y administrador creados correctamente" }

  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/* ===============================
   SOFT DELETE COMPANY
=============================== */
export const deleteCompany = async (id) => {

  const result = await db.query(
    `UPDATE public.companies
     SET deleted_at = NOW(),
         is_active = false
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id`,
    [id]
  )

  if (result.rows.length === 0) {
    throw new Error("Empresa no encontrada")
  }

  return { message: "Empresa eliminada correctamente" }
}