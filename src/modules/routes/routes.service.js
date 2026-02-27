import db from "../../database/db.js"

/* =========================================================
   CREAR RUTA (MANUAL)
========================================================= */
export const createRoute = async ({ company_id, user_id, local_id }) => {

  // 🔎 Validar usuario pertenece a empresa
  const userResult = await db.query(
    `
    SELECT id FROM users
    WHERE id = $1 AND company_id = $2
    `,
    [user_id, company_id]
  )

  if (userResult.rows.length === 0) {
    throw new Error("Usuario no pertenece a la empresa")
  }

  // 🔎 Validar local pertenece a empresa
  const localResult = await db.query(
    `
    SELECT id FROM locales
    WHERE id = $1 AND company_id = $2
    `,
    [local_id, company_id]
  )

  if (localResult.rows.length === 0) {
    throw new Error("Local no pertenece a la empresa")
  }

  // 🔒 Evitar duplicados
  const duplicateCheck = await db.query(
    `
    SELECT id FROM user_routes
    WHERE user_id = $1 AND local_id = $2
    `,
    [user_id, local_id]
  )

  if (duplicateCheck.rows.length > 0) {
    throw new Error("Ruta ya asignada a este usuario")
  }

  const result = await db.query(
    `
    INSERT INTO user_routes (
      company_id,
      user_id,
      local_id
    )
    VALUES ($1,$2,$3)
    RETURNING *
    `,
    [company_id, user_id, local_id]
  )

  return result.rows[0]
}


/* =========================================================
   OBTENER RUTAS POR EMPRESA
========================================================= */
export const getRoutesByCompany = async (company_id) => {

  const result = await db.query(
    `
    SELECT ur.id,
           ur.user_id,
           u.first_name,
           ur.local_id,
           l.cadena,
           l.comuna,
           ur.created_at
    FROM user_routes ur
    JOIN users u ON ur.user_id = u.id
    JOIN locales l ON ur.local_id = l.id
    WHERE ur.company_id = $1
    ORDER BY ur.created_at DESC
    `,
    [company_id]
  )

  return result.rows
}


/* =========================================================
   OBTENER RUTAS POR USUARIO
========================================================= */
export const getRoutesByUser = async (company_id, user_id) => {

  const result = await db.query(
    `
    SELECT ur.id,
           l.id as local_id,
           l.cadena,
           l.comuna,
           l.region
    FROM user_routes ur
    JOIN locales l ON ur.local_id = l.id
    WHERE ur.company_id = $1
      AND ur.user_id = $2
    `,
    [company_id, user_id]
  )

  return result.rows
}


/* =========================================================
   ELIMINAR RUTA
========================================================= */
export const deleteRoute = async (company_id, route_id) => {

  const result = await db.query(
    `
    DELETE FROM user_routes
    WHERE id = $1 AND company_id = $2
    RETURNING id
    `,
    [route_id, company_id]
  )

  if (result.rows.length === 0) {
    throw new Error("Ruta no encontrada")
  }

  return { message: "Ruta eliminada correctamente" }
}