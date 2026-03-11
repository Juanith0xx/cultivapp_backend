import db from "../../database/db.js"
import xlsx from "xlsx"
import geocodeAddress from "../../utils/geocodeAddress.js"

/* =========================================
    HELPERS
========================================= */

const clean = (value) => {
  if (value === undefined || value === null) return null
  return String(value).trim()
}

/* =========================================
    OBTENER LOCALES (TABLA BASE CON JOINS)
========================================= */

export const getLocales = async (company_id) => {
  // Consultamos la tabla 'locales' directamente para incluir is_active = false
  // Usamos LEFT JOIN para obtener los nombres de region y comuna que el frontend espera
  let query = `
    SELECT 
      l.*,
      r.name AS region,
      c.name AS comuna
    FROM public.locales l
    LEFT JOIN regions r ON l.region_id = r.id
    LEFT JOIN comunas c ON l.comuna_id = c.id
    WHERE l.deleted_at IS NULL
  `

  let values = []

  if (company_id) {
    values.push(company_id)
    query += ` AND l.company_id = $${values.length}`
  }

  query += ` ORDER BY l.created_at DESC`

  const result = await db.query(query, values)

  return result.rows
}

/* =========================================
    OBTENER LOCAL POR ID
========================================= */

export const getLocalById = async (id) => {
  const result = await db.query(
    `
    SELECT *
    FROM public.locales
    WHERE id = $1
      AND deleted_at IS NULL
    `,
    [id]
  )

  return result.rows[0]
}

/* =========================================
    CREAR LOCAL
========================================= */

export const createLocal = async (data) => {
  const {
    company_id,
    cadena,
    region_id,
    comuna_id,
    direccion,
    gerente,
    telefono
  } = data

  if (!company_id) {
    throw new Error("Empresa requerida")
  }

  if (!cadena || !region_id || !comuna_id || !direccion) {
    throw new Error("Faltan campos obligatorios")
  }

  const location = await db.query(
    `
    SELECT
      r.name AS region,
      c.name AS comuna
    FROM regions r
    JOIN comunas c ON c.region_id = r.id
    WHERE r.id = $1
      AND c.id = $2
    `,
    [region_id, comuna_id]
  )

  if (!location.rows.length) {
    throw new Error("Región o comuna inválida")
  }

  const { region, comuna } = location.rows[0]
  const fullAddress = `${direccion}, ${comuna}, ${region}, Chile`
  const coordinates = await geocodeAddress(fullAddress)

  const lat = coordinates?.lat || null
  const lng = coordinates?.lng || null

  const result = await db.query(
    `
    INSERT INTO locales (
      company_id,
      cadena,
      region_id,
      comuna_id,
      direccion,
      gerente,
      telefono,
      lat,
      lng
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      company_id,
      clean(cadena),
      region_id,
      comuna_id,
      clean(direccion),
      clean(gerente),
      clean(telefono),
      lat,
      lng
    ]
  )

  return result.rows[0]
}

/* =========================================
    ACTUALIZAR LOCAL
========================================= */

export const updateLocal = async (id, data) => {
  const {
    cadena,
    region_id,
    comuna_id,
    direccion,
    gerente,
    telefono
  } = data

  const location = await db.query(
    `
    SELECT
      r.name AS region,
      c.name AS comuna
    FROM regions r
    JOIN comunas c ON c.region_id = r.id
    WHERE r.id = $1
      AND c.id = $2
    `,
    [region_id, comuna_id]
  )

  const { region, comuna } = location.rows[0]
  const fullAddress = `${direccion}, ${comuna}, ${region}, Chile`
  const coordinates = await geocodeAddress(fullAddress)

  const lat = coordinates?.lat || null
  const lng = coordinates?.lng || null

  const result = await db.query(
    `
    UPDATE locales
    SET
      cadena=$1,
      region_id=$2,
      comuna_id=$3,
      direccion=$4,
      gerente=$5,
      telefono=$6,
      lat=$7,
      lng=$8,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=$9
    RETURNING *
    `,
    [
      clean(cadena),
      region_id,
      comuna_id,
      clean(direccion),
      clean(gerente),
      clean(telefono),
      lat,
      lng,
      id
    ]
  )

  return result.rows[0]
}

/* =========================================
    TOGGLE LOCAL
========================================= */

export const toggleLocal = async (id) => {
  const result = await db.query(
    `
    UPDATE locales
    SET
      is_active = NOT is_active,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [id]
  )

  return result.rows[0]
}

/* =========================================
    DELETE LOCAL
========================================= */

export const deleteLocal = async (id) => {
  await db.query(
    `
    UPDATE locales
    SET deleted_at = NOW()
    WHERE id = $1
    `,
    [id]
  )

  return true
}

/* =========================================
    CARGA MASIVA EXCEL
========================================= */

export const uploadLocalesFromExcel = async (fileBuffer, company_id) => {
  const workbook = xlsx.read(fileBuffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rows = xlsx.utils.sheet_to_json(sheet)
  const client = await db.connect()

  try {
    await client.query("BEGIN")

    for (const row of rows) {
      const {
        cadena,
        region_id,
        comuna_id,
        direccion,
        gerente,
        telefono
      } = row

      const location = await client.query(
        `
        SELECT
          r.name AS region,
          c.name AS comuna
        FROM regions r
        JOIN comunas c ON c.region_id = r.id
        WHERE r.id = $1
          AND c.id = $2
        `,
        [region_id, comuna_id]
      )

      const { region, comuna } = location.rows[0]
      const fullAddress = `${direccion}, ${comuna}, ${region}, Chile`
      const coordinates = await geocodeAddress(fullAddress)

      const lat = coordinates?.lat || null
      const lng = coordinates?.lng || null

      await client.query(
        `
        INSERT INTO locales (
          company_id,
          cadena,
          region_id,
          comuna_id,
          direccion,
          gerente,
          telefono,
          lat,
          lng
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          company_id,
          clean(cadena),
          region_id,
          comuna_id,
          clean(direccion),
          clean(gerente),
          clean(telefono),
          lat,
          lng
        ]
      )
    }

    await client.query("COMMIT")
    return { inserted: rows.length }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}