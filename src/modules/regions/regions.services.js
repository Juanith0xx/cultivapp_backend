import db from "../../database/db.js"

export const getRegions = async () => {

  const result = await db.query(`
    SELECT id, name, code
    FROM regions
    ORDER BY name
  `)

  return result.rows

}