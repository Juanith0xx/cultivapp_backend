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

    // 🔎 1. Traemos los datos. Usamos LEFT JOIN para que los ROOT (sin empresa) puedan entrar.
    const result = await pool.query(
      `
    SELECT u.session_id, u.is_active, u.deleted_at, u.company_id, u.role, c.name as company_name
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE u.id = $1
  `,  
      [decoded.id]
    )

    if (!result.rows.length) {
      return res.status(401).json({ message: "Usuario no existe" })
    }

    const user = result.rows[0]

    // 🔥 Validaciones de seguridad
    if (user.deleted_at) return res.status(401).json({ message: "Usuario eliminado" })
    if (!user.is_active) return res.status(401).json({ message: "Cuenta deshabilitada" })
    
    // Validar sesión activa (Importante: revisa que tu login asigne session_id al Root)
    if (!user.session_id || user.session_id !== decoded.session_id) {
      return res.status(401).json({ message: "Sesión cerrada por inicio en otro dispositivo" })
    }

    // 🚩 2. Inyectamos los datos REALES
    req.user = {
      ...decoded,
      company_id: user.company_id,
      company_name: user.company_name || "ADMINISTRACIÓN CENTRAL", // Nombre por defecto para Root
      role: user.role
    }

    next()

  } catch (error) {
    console.error("Error en Auth Middleware:", error)
    return res.status(401).json({ message: "Token inválido" })
  }
}

export default authMiddleware