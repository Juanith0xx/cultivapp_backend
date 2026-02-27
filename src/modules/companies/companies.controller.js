import db from "../../database/db.js"
import bcrypt from "bcryptjs"

/* =========================================================
   OBTENER EMPRESAS
   (ROOT puede ver todas activas/inactivas)
========================================================= */
export const getCompanies = async (req, res) => {
  try {

    const result = await db.query(`
      SELECT 
        id,
        rut,
        name,
        address,
        max_supervisors,
        max_users,
        max_view,
        is_active,
        created_at
      FROM companies
      ORDER BY created_at DESC
    `)

    res.json(result.rows)

  } catch (error) {
    console.error("GET COMPANIES ERROR:", error)
    res.status(500).json({ message: "Error al obtener empresas" })
  }
}


/* =========================================================
   CREAR EMPRESA + ADMIN CLIENTE
========================================================= */
export const createCompanyWithAdmin = async (req, res) => {

  const {
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
  } = req.body

  if (!rut || !name || !address || !admin_name || !admin_email || !admin_password) {
    return res.status(400).json({ message: "Faltan campos obligatorios" })
  }

  const client = await db.connect()

  try {
    await client.query("BEGIN")

    // 🔍 Validar RUT duplicado
    const rutExists = await client.query(
      `SELECT id FROM companies WHERE rut = $1`,
      [rut]
    )

    if (rutExists.rows.length > 0) {
      throw new Error("El RUT ya está registrado")
    }

    // 🔍 Validar email admin duplicado
    const emailExists = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [admin_email]
    )

    if (emailExists.rows.length > 0) {
      throw new Error("El correo del administrador ya existe")
    }

    // 1️⃣ Crear empresa
    const companyResult = await client.query(
      `
      INSERT INTO companies (
        rut,
        name,
        address,
        max_supervisors,
        max_users,
        max_view,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,true)
      RETURNING id
      `,
      [
        rut,
        name,
        address,
        parseInt(max_supervisors) || 0,
        parseInt(max_users) || 0,
        parseInt(max_view) || 0
      ]
    )

    const company_id = companyResult.rows[0].id

    // 2️⃣ Crear admin cliente
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

    res.status(201).json({
      message: "Empresa y administrador creados correctamente"
    })

  } catch (error) {
    await client.query("ROLLBACK")
    console.error("CREATE COMPANY ERROR:", error)
    res.status(500).json({ message: error.message })
  } finally {
    client.release()
  }
}


/* =========================================================
   TOGGLE EMPRESA (ACTIVAR / DESACTIVAR)
   Si se desactiva → desactiva usuarios también
========================================================= */
export const toggleCompany = async (req, res) => {

  const { id } = req.params
  const client = await db.connect()

  try {

    await client.query("BEGIN")

    const result = await client.query(
      `
      UPDATE companies
      SET is_active = NOT is_active
      WHERE id = $1
      RETURNING id, name, is_active
      `,
      [id]
    )

    if (result.rows.length === 0) {
      throw new Error("Empresa no encontrada")
    }

    const company = result.rows[0]

    // 🔥 Si la empresa quedó inactiva → desactivar usuarios
    if (!company.is_active) {
      await client.query(
        `
        UPDATE users
        SET is_active = false
        WHERE company_id = $1
        `,
        [id]
      )
    }

    await client.query("COMMIT")

    res.json(company)

  } catch (error) {
    await client.query("ROLLBACK")
    console.error("TOGGLE COMPANY ERROR:", error)
    res.status(500).json({ message: error.message })
  } finally {
    client.release()
  }
}