import db from "../../database/db.js"
import xlsx from "xlsx"

/* =========================================
   HELPERS
========================================= */

const clean = (value) => {
  if (value === undefined || value === null) return null
  return String(value).trim()
}

/* =========================================
   OBTENER LOCALES (SOFT DELETE SAFE)
========================================= */
export const getLocales = async (company_id) => {

  let query = `
    SELECT *
    FROM public.locales
    WHERE deleted_at IS NULL
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
   OBTENER LOCAL POR ID (SOFT DELETE SAFE)
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

  if (!company_id) {
    throw new Error("Empresa requerida")
  }

  if (!cadena || !region || !comuna || !direccion) {
    throw new Error("Faltan campos obligatorios")
  }

  const company = await db.query(
    `
    SELECT id
    FROM public.companies
    WHERE id = $1
      AND deleted_at IS NULL
    `,
    [company_id]
  )

  if (company.rows.length === 0) {
    throw new Error("Empresa no válida")
  }

  const result = await db.query(
    `
    INSERT INTO public.locales (
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
      clean(cadena),
      clean(region),
      clean(comuna),
      clean(direccion),
      clean(gerente),
      clean(telefono)
    ]
  )

  return result.rows[0]
}

/* =========================================
   ACTUALIZAR LOCAL
========================================= */
export const updateLocal = async (id, data) => {

  const existing = await getLocalById(id)

  if (!existing) {
    throw new Error("Local no encontrado")
  }

  const {
    cadena,
    region,
    comuna,
    direccion,
    gerente,
    telefono
  } = data

  if (!cadena || !region || !comuna || !direccion) {
    throw new Error("Faltan campos obligatorios")
  }

  const result = await db.query(
    `
    UPDATE public.locales
    SET
      cadena = $1,
      region = $2,
      comuna = $3,
      direccion = $4,
      gerente = $5,
      telefono = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
      AND deleted_at IS NULL
    RETURNING *
    `,
    [
      clean(cadena),
      clean(region),
      clean(comuna),
      clean(direccion),
      clean(gerente),
      clean(telefono),
      id
    ]
  )

  return result.rows[0]
}

/* =========================================
   TOGGLE LOCAL
========================================= */
export const toggleLocal = async (id) => {

  const existing = await getLocalById(id)

  if (!existing) {
    throw new Error("Local no encontrado")
  }

  const result = await db.query(
    `
    UPDATE public.locales
    SET
      is_active = NOT is_active,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING *
    `,
    [id]
  )

  return result.rows[0]
}

/* =========================================
   SOFT DELETE LOCAL
========================================= */
export const deleteLocal = async (id) => {

  const existing = await getLocalById(id)

  if (!existing) {
    throw new Error("Local no encontrado")
  }

  await db.query(
    `
    UPDATE public.locales
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

  if (!company_id) {
    throw new Error("Empresa requerida")
  }

  const company = await db.query(
    `
    SELECT id
    FROM public.companies
    WHERE id = $1
      AND deleted_at IS NULL
    `,
    [company_id]
  )

  if (company.rows.length === 0) {
    throw new Error("Empresa no válida")
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
        INSERT INTO public.locales (
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
          clean(cadena),
          clean(region),
          clean(comuna),
          clean(direccion),
          clean(gerente),
          clean(telefono)
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