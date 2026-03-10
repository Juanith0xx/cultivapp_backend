import db from "../../database/db.js"

export const getComunas = async (region_id) => {

  const result = await db.query(
    `
    SELECT id, name
    FROM comunas
    WHERE region_id = $1
    ORDER BY name
    `,
    [region_id]
  )

  return result.rows

}