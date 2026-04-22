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
      WHERE deleted_at IS NULL
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

/* =========================================================
   ACTUALIZAR PLAN (LÍMITES)
   Basado en esquema real: id, rut, name, max_supervisors, max_users, max_view
========================================================= */
export const updateCompanyPlan = async (req, res) => {
  const { id } = req.params;
  const { max_supervisors, max_users, max_view } = req.body;

  // Validación de formato UUID para evitar errores de sintaxis en Postgres
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ message: "ID de empresa no válido" });
  }

  try {
    // 🚩 IMPORTANTE: Eliminada columna 'updated_at' que no existe en tu tabla
    const query = `
      UPDATE companies 
      SET 
        max_supervisors = $1, 
        max_users = $2, 
        max_view = $3
      WHERE id = $4 AND deleted_at IS NULL
      RETURNING id, name, max_supervisors, max_users, max_view;
    `;

    const values = [
      parseInt(max_supervisors) || 0,
      parseInt(max_users) || 0,
      parseInt(max_view) || 0,
      id
    ];

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        message: "Empresa no encontrada o ha sido eliminada" 
      });
    }

    res.json({
      message: "Límites del plan actualizados correctamente",
      company: result.rows[0]
    });

  } catch (error) {
    console.error("❌ UPDATE PLAN ERROR:", error.message);
    res.status(500).json({ 
      message: "Error al actualizar los límites del plan",
      details: error.message 
    });
  }
};