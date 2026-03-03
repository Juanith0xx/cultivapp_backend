import pool from "../database/db.js"

export const logAction = async (
  userId,
  action,
  entity = null,
  entityId = null
) => {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (user_id, action, entity, entity_id)
      VALUES ($1, $2, $3, $4)
      `,
      [userId, action, entity, entityId]
    )
  } catch (error) {
    console.error("AUDIT LOG ERROR:", error)
  }
}