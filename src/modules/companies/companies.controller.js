import db from "../../database/db.js"
import bcrypt from "bcryptjs"

// 🚩 CONSTANTE MAESTRA: ID DE CULTIVA
const ID_CULTIVA = '0e342e01-d213-4353-b210-39a12ac335cf';

/* =========================================================
   OBTENER EMPRESAS
   (ROOT o ADMIN CULTIVA pueden ver todas)
========================================================= */
export const getCompanies = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, rut, name, address, max_supervisors, 
        max_users, max_view, is_active, created_at
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
  const loggedUser = req.user;

  // 🛡️ LÓGICA DE ACCESO ELEVADO
  const isRoot = loggedUser.role === "ROOT";
  const isCultivaAdmin = loggedUser.role === "ADMIN_CLIENTE" && loggedUser.company_id === ID_CULTIVA;

  if (!isRoot && !isCultivaAdmin) {
    return res.status(403).json({ 
      message: "Acceso denegado: No tienes permisos de administración global" 
    });
  }

  // 🚩 DEBUG: Ver qué está llegando desde el Modal
  console.log("📩 Payload recibido en createCompany:", req.body);

  const {
    rut, name, address, 
    max_supervisors, max_users, max_view,
    admin_name, admin_email, admin_phone, admin_position, admin_password
  } = req.body

  // 🚩 VALIDACIÓN DETALLADA PARA EVITAR EL ERROR 400 GENÉRICO
  const missingFields = [];
  if (!rut) missingFields.push("rut");
  if (!name) missingFields.push("name");
  if (!address) missingFields.push("address");
  if (!admin_name) missingFields.push("admin_name");
  if (!admin_email) missingFields.push("admin_email");
  if (!admin_password) missingFields.push("admin_password");

  if (missingFields.length > 0) {
    console.error("❌ Faltan campos obligatorios:", missingFields.join(", "));
    return res.status(400).json({ 
      message: `Faltan campos obligatorios: ${missingFields.join(", ")}` 
    });
  }

  const client = await db.connect()

  try {
    await client.query("BEGIN")

    // 🔍 Validar RUT duplicado
    const rutExists = await client.query(`SELECT id FROM companies WHERE rut = $1`, [rut])
    if (rutExists.rows.length > 0) throw new Error("El RUT ya está registrado")

    // 🔍 Validar email admin duplicado
    const emailExists = await client.query(`SELECT id FROM users WHERE email = $1`, [admin_email])
    if (emailExists.rows.length > 0) throw new Error("El correo del administrador ya existe")

    // 1️⃣ Crear empresa
    const companyResult = await client.query(
      `INSERT INTO companies (rut, name, address, max_supervisors, max_users, max_view, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
      [rut, name, address, parseInt(max_supervisors) || 0, parseInt(max_users) || 0, parseInt(max_view) || 0]
    )

    const company_id = companyResult.rows[0].id

    // 2️⃣ Crear admin cliente
    const hashedPassword = await bcrypt.hash(admin_password, 10)
    await client.query(
      `INSERT INTO users (company_id, first_name, email, password_hash, role, is_active, phone, position)
       VALUES ($1,$2,$3,$4,'ADMIN_CLIENTE',true,$5,$6)`,
      [company_id, admin_name, admin_email, hashedPassword, admin_phone || null, admin_position || null]
    )

    await client.query("COMMIT")
    res.status(201).json({ message: "Empresa y administrador creados correctamente" })

  } catch (error) {
    await client.query("ROLLBACK")
    console.error("CREATE COMPANY ERROR:", error.message)
    res.status(500).json({ message: error.message })
  } finally {
    client.release()
  }
}


/* =========================================================
   TOGGLE EMPRESA (ACTIVAR / DESACTIVAR)
========================================================= */
export const toggleCompany = async (req, res) => {
  const loggedUser = req.user;
  const { id } = req.params;

  const isRoot = loggedUser.role === "ROOT";
  const isCultivaAdmin = loggedUser.role === "ADMIN_CLIENTE" && loggedUser.company_id === ID_CULTIVA;

  if (!isRoot && !isCultivaAdmin) {
    return res.status(403).json({ message: "No tienes permisos para modificar el estado" });
  }

  const client = await db.connect()

  try {
    await client.query("BEGIN")
    const result = await client.query(
      `UPDATE companies SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active`,
      [id]
    )

    if (result.rows.length === 0) throw new Error("Empresa no encontrada")

    const company = result.rows[0]
    if (!company.is_active) {
      await client.query(`UPDATE users SET is_active = false WHERE company_id = $1`, [id])
    }

    await client.query("COMMIT")
    res.json(company)

  } catch (error) {
    await client.query("ROLLBACK")
    console.error("TOGGLE ERROR:", error.message)
    res.status(500).json({ message: error.message })
  } finally {
    client.release()
  }
}

/* =========================================================
   ACTUALIZAR PLAN (LÍMITES)
========================================================= */
export const updateCompanyPlan = async (req, res) => {
  const loggedUser = req.user;
  const { id } = req.params;
  const { max_supervisors, max_users, max_view } = req.body;

  const isRoot = loggedUser.role === "ROOT";
  const isCultivaAdmin = loggedUser.role === "ADMIN_CLIENTE" && loggedUser.company_id === ID_CULTIVA;

  if (!isRoot && !isCultivaAdmin) {
    return res.status(403).json({ message: "No tienes permisos globales" });
  }

  try {
    const query = `
      UPDATE companies 
      SET max_supervisors = $1, max_users = $2, max_view = $3
      WHERE id = $4 AND deleted_at IS NULL
      RETURNING id, name, max_supervisors, max_users, max_view;
    `;

    const result = await db.query(query, [
      parseInt(max_supervisors) || 0, 
      parseInt(max_users) || 0, 
      parseInt(max_view) || 0, 
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No encontrada o eliminada" });
    }

    res.json({ message: "Plan actualizado", company: result.rows[0] });

  } catch (error) {
    console.error("UPDATE PLAN ERROR:", error.message);
    res.status(500).json({ message: "Error al actualizar", details: error.message });
  }
};

/* =========================================================
   ELIMINAR EMPRESA (SOFT DELETE)
========================================================= */
export const deleteCompany = async (req, res) => {
  const loggedUser = req.user;
  const { id } = req.params;

  if (loggedUser.role !== "ROOT") {
    return res.status(403).json({ message: "Acción restringida solo al ROOT" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE companies SET deleted_at = NOW(), is_active = false WHERE id = $1 RETURNING name`,
      [id]
    );

    if (result.rows.length === 0) throw new Error("No encontrada");
    await client.query(`UPDATE users SET is_active = false WHERE company_id = $1`, [id]);

    await client.query("COMMIT");
    res.json({ message: "Empresa eliminada correctamente" });

  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};