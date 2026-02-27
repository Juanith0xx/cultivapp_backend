import db from "../../database/db.js"
import bcrypt from "bcryptjs"

/* ===============================
   OBTENER EMPRESAS
=============================== */
export const getCompanies = async () => {

  const result = await db.query(`
    SELECT id, rut, name, address,
           max_supervisors, max_users, max_view,
           is_active, created_at
    FROM companies
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

    // Validar RUT
    const rutExists = await client.query(
      `SELECT id FROM companies WHERE rut = $1`,
      [rut]
    )

    if (rutExists.rows.length > 0) {
      throw new Error("El RUT ya está registrado")
    }

    // Validar email admin
    const emailExists = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [admin_email]
    )

    if (emailExists.rows.length > 0) {
      throw new Error("El correo del administrador ya existe")
    }

    // Crear empresa
    const companyResult = await client.query(
      `
      INSERT INTO companies (
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
        rut,
        name,
        address,
        max_supervisors || 0,
        max_users || 0,
        max_view || 0
      ]
    )

    const company_id = companyResult.rows[0].id

    // Crear admin cliente
    const hashedPassword = await bcrypt.hash(admin_password, 10)

    await client.query(
      `
      INSERT INTO users (
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
        admin_name,
        admin_email,
        hashedPassword,
        admin_phone || null,
        admin_position || null
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