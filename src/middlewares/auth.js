import jwt from "jsonwebtoken"
import pool from "../database/db.js"

const authMiddleware = async (req, res, next) => {

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No autorizado" })
  }

  const token = authHeader.split(" ")[1]

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // 🔎 Validar usuario + sesión + soft delete
    const result = await pool.query(
      `
      SELECT session_id, is_active, deleted_at
      FROM users
      WHERE id = $1
      `,
      [decoded.id]
    )

    if (!result.rows.length) {
      return res.status(401).json({ message: "Usuario no existe" })
    }

    const user = result.rows[0]

    // 🔥 Validar soft delete
    if (user.deleted_at) {
      return res.status(401).json({ message: "Usuario eliminado" })
    }

    // 🔥 Validar estado activo
    if (!user.is_active) {
      return res.status(401).json({ message: "Cuenta deshabilitada" })
    }

    // 🔥 Validar sesión activa
    if (!user.session_id || user.session_id !== decoded.session_id) {
      return res.status(401).json({
        message: "Sesión cerrada por inicio en otro dispositivo"
      })
    }

    req.user = decoded
    next()

  } catch (error) {
    return res.status(401).json({ message: "Token inválido" })
  }
}

export default authMiddleware