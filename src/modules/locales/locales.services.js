import db from "../../database/db.js"
import xlsx from "xlsx"

/* =========================================
   OBTENER LOCALES
========================================= */
export const getLocales = async (company_id) => {

  let query = `
    SELECT *
    FROM locales
    WHERE 1=1
  `
  let values = []

  if (company_id) {
    values.push(company_id)
    query += ` AND company_id = $${values.length}`
  }

  query += ` ORDER BY created_at DESC`

  const result = await db.query(query, values)
  return result.rows
}

/* =========================================
   OBTENER LOCAL POR ID (para validaciones)
========================================= */
export const getLocalById = async (id) => {
  const result = await db.query(
    `SELECT * FROM locales WHERE id = $1`,
    [id]
  )

  return result.rows[0]
}

/* =========================================
   CREAR LOCAL MANUAL
========================================= */
export const createLocal = async (data) => {

  const {
    company_id,
    cadena,
    region,
    comuna,
    direccion,
    gerente,
    telefono
  } = data

  // 🔒 Validación fuerte
  if (!company_id) {
    throw new Error("Empresa requerida")
  }

  if (!cadena || !region || !comuna || !direccion) {
    throw new Error("Faltan campos obligatorios")
  }

  const result = await db.query(
    `
    INSERT INTO locales (
      company_id,
      cadena,
      region,
      comuna,
      direccion,
      gerente,
      telefono
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      company_id,
      cadena.trim(),
      region.trim(),
      comuna.trim(),
      direccion.trim(),
      gerente ? gerente.trim() : null,
      telefono ? telefono.trim() : null
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
    SET is_active = NOT is_active,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [id]
  )

  if (result.rows.length === 0) {
    throw new Error("Local no encontrado")
  }

  return result.rows[0]
}

/* =========================================
   ELIMINAR LOCAL
========================================= */
export const deleteLocal = async (id) => {

  const result = await db.query(
    `DELETE FROM locales WHERE id = $1 RETURNING id`,
    [id]
  )

  if (result.rows.length === 0) {
    throw new Error("Local no encontrado")
  }

  return true
}

/* =========================================
   CARGA MASIVA DESDE EXCEL
========================================= */
export const uploadLocalesFromExcel = async (fileBuffer, company_id) => {

  if (!company_id) {
    throw new Error("Empresa requerida")
  }

  const workbook = xlsx.read(fileBuffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rows = xlsx.utils.sheet_to_json(sheet)

  if (!rows.length) {
    throw new Error("El archivo está vacío")
  }

  const client = await db.connect()

  try {
    await client.query("BEGIN")

    const insertedRows = []
    const errors = []

    for (let i = 0; i < rows.length; i++) {

      const rowNumber = i + 2

      const {
        cadena,
        region,
        comuna,
        direccion,
        gerente,
        telefono
      } = rows[i]

      if (!cadena || !region || !comuna || !direccion) {
        errors.push({
          row: rowNumber,
          error: "Faltan campos obligatorios"
        })
        continue
      }

      await client.query(
        `
        INSERT INTO locales (
          company_id,
          cadena,
          region,
          comuna,
          direccion,
          gerente,
          telefono
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          company_id,
          cadena.trim(),
          region.trim(),
          comuna.trim(),
          direccion.trim(),
          gerente ? gerente.trim() : null,
          telefono ? telefono.trim() : null
        ]
      )

      insertedRows.push(rowNumber)
    }

    await client.query("COMMIT")

    return {
      inserted: insertedRows.length,
      errors
    }

  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}