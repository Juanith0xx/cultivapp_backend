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
    OBTENER LOCALES
========================================= */
export const getLocales = async (company_id) => {
  let query = `
    SELECT 
      l.*,
      r.name AS region,
      c.name AS comuna,
      r.name AS region_name,
      c.name AS comuna_name
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
    🚩 OBTENER LOCALES POR SUPERVISOR (CARTERA)
========================================= */
export const getLocalesBySupervisor = async (supervisor_id) => {
  try {
    const query = `
      SELECT 
        l.*,
        r.name AS region_name,
        c.name AS comuna_name,
        -- Mapeamos chain_id para que el filtro del frontend sea compatible
        l.cadena as chain_id 
      FROM public.locales l
      INNER JOIN public.supervisor_locales sl ON l.id = sl.locale_id
      LEFT JOIN regions r ON l.region_id = r.id
      LEFT JOIN comunas c ON l.comuna_id = c.id
      WHERE sl.supervisor_id = $1 
        AND l.deleted_at IS NULL
      ORDER BY l.cadena ASC;
    `;
    
    const result = await db.query(query, [supervisor_id]);
    return result.rows;
  } catch (error) {
    console.error("❌ Error en getLocalesBySupervisor Service:", error.message);
    throw error;
  }
}

/* =========================================
    OBTENER LOCAL POR ID
========================================= */
export const getLocalById = async (id) => {
  const result = await db.query(
    `SELECT * FROM public.locales WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  )
  return result.rows[0]
}

/* =========================================
    CREAR LOCAL
========================================= */
export const createLocal = async (data) => {
  const {
    company_id, cadena, region_id, comuna_id,
    direccion, gerente, telefono, codigo_local 
  } = data

  if (!company_id) throw new Error("Empresa requerida")
  
  const location = await db.query(
    `SELECT r.name AS region, c.name AS comuna 
     FROM regions r JOIN comunas c ON c.region_id = r.id 
     WHERE r.id = $1 AND c.id = $2`,
    [region_id, comuna_id]
  )

  const { region, comuna } = location.rows[0] || { region: "", comuna: "" }
  const fullAddress = `${direccion}, ${comuna}, ${region}, Chile`
  const coordinates = await geocodeAddress(fullAddress)

  const result = await db.query(
    `INSERT INTO locales (
      company_id, cadena, region_id, comuna_id, direccion, 
      gerente, telefono, lat, lng, codigo_local
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      company_id, 
      clean(cadena), 
      region_id, 
      comuna_id, 
      clean(direccion), 
      clean(gerente), 
      clean(telefono), 
      coordinates?.lat || null, 
      coordinates?.lng || null, 
      clean(codigo_local)
    ]
  )
  return result.rows[0]
}

/* =========================================
    ACTUALIZAR LOCAL
========================================= */
export const updateLocal = async (id, data) => {
  const { cadena, region_id, comuna_id, direccion, gerente, telefono, codigo_local } = data

  const location = await db.query(
    `SELECT r.name AS region, c.name AS comuna FROM regions r JOIN comunas c ON c.region_id = r.id WHERE r.id = $1 AND c.id = $2`,
    [region_id, comuna_id]
  )

  const { region, comuna } = location.rows[0] || { region: "", comuna: "" }
  const fullAddress = `${direccion}, ${comuna}, ${region}, Chile`
  const coordinates = await geocodeAddress(fullAddress)

  const result = await db.query(
    `UPDATE locales
    SET cadena=$1, region_id=$2, comuna_id=$3, direccion=$4, gerente=$5, telefono=$6, lat=$7, lng=$8, codigo_local=$9, updated_at=CURRENT_TIMESTAMP
    WHERE id=$10 RETURNING *`,
    [
      clean(cadena), 
      region_id, 
      comuna_id, 
      clean(direccion), 
      clean(gerente), 
      clean(telefono), 
      coordinates?.lat || null, 
      coordinates?.lng || null, 
      clean(codigo_local), 
      id
    ]
  )
  return result.rows[0]
}

/* =========================================
    TOGGLE / DELETE
========================================= */
export const toggleLocal = async (id) => {
  const result = await db.query(`UPDATE locales SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id])
  return result.rows[0]
}

export const deleteLocal = async (id) => {
  await db.query(`UPDATE locales SET deleted_at = NOW() WHERE id = $1`, [id])
  return true
}

/* =========================================
    CARGA MASIVA EXCEL (🚩 MEJORADO CON REPORTES)
========================================= */
export const uploadLocalesFromExcel = async (fileBuffer, company_id) => {
  const workbook = xlsx.read(fileBuffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet)
  
  const client = await db.connect()
  let insertedCount = 0
  const errors = [] // 🚩 Para devolver al frontend

  try {
    await client.query("BEGIN")

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const filaNum = i + 2 // Cabecera + índice 0
      
      const excelCodigo = clean(row.codigo)
      const excelCadena = clean(row.cadena)
      const excelDireccion = clean(row.direccion)
      const excelComuna = clean(row.comuna)

      // 1. Validaciones básicas de fila
      if (!excelComuna || !excelDireccion || !excelCadena) {
        errors.push({ 
          fila: filaNum, 
          codigo: excelCodigo, 
          error: "Faltan datos obligatorios (cadena, dirección o comuna)" 
        })
        continue
      }

      // 2. Buscar IDs por nombre de Comuna
      const locationSearch = await client.query(
        `SELECT c.id as comuna_id, c.region_id, r.name as region_name, c.name as comuna_name
         FROM comunas c 
         JOIN regions r ON c.region_id = r.id
         WHERE LOWER(TRIM(c.name)) = LOWER(TRIM($1)) LIMIT 1`,
        [excelComuna]
      )

      if (locationSearch.rows.length === 0) {
        errors.push({ 
          fila: filaNum, 
          codigo: excelCodigo, 
          error: `La comuna "${excelComuna}" no existe en el sistema` 
        })
        continue
      }

      const { comuna_id, region_id, region_name, comuna_name } = locationSearch.rows[0]

      // 3. Geocodificación (Opcional, no detiene el proceso si falla)
      let coords = null
      try {
        const fullAddress = `${excelDireccion}, ${comuna_name}, ${region_name}, Chile`
        coords = await geocodeAddress(fullAddress)
      } catch (geoErr) {
        console.warn(`Geo error fila ${filaNum}: ${geoErr.message}`)
      }

      // 4. Insertar / Actualizar
      await client.query(
        `INSERT INTO locales (
          company_id, cadena, region_id, comuna_id, direccion, 
          gerente, telefono, lat, lng, codigo_local
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (codigo_local, company_id) DO UPDATE SET
          cadena = EXCLUDED.cadena,
          direccion = EXCLUDED.direccion,
          region_id = EXCLUDED.region_id,
          comuna_id = EXCLUDED.comuna_id,
          updated_at = NOW()`,
        [
          company_id, 
          excelCadena, 
          region_id, 
          comuna_id, 
          excelDireccion,
          clean(row.gerente) || "Sin informacion", 
          clean(row.telefono) || "Sin informacion", 
          coords?.lat || null, 
          coords?.lng || null, 
          excelCodigo
        ]
      )
      insertedCount++
    }

    await client.query("COMMIT")
    return { inserted: insertedCount, errors }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}