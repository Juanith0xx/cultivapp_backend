import jwt from "jsonwebtoken";
import pool from "../database/db.js";

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No autorizado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔎 Traemos los datos frescos de la DB (Agregamos first_name y last_name)
    const result = await pool.query(
      `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.session_id, 
        u.is_active, 
        u.deleted_at, 
        u.company_id, 
        u.role, 
        c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1
      `,  
      [decoded.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({ message: "Usuario no existe" });
    }

    const user = result.rows[0];

    // 🔥 Validaciones de seguridad
    if (user.deleted_at) return res.status(401).json({ message: "Usuario eliminado" });
    if (!user.is_active) return res.status(401).json({ message: "Cuenta deshabilitada" });
    
    if (!user.session_id || user.session_id !== decoded.session_id) {
      return res.status(401).json({ message: "Sesión cerrada por inicio en otro dispositivo" });
    }

    // 🚩 Inyectamos los datos REALES
    // Ahora incluimos 'full_name' generado desde la DB para que Multer lo use siempre
    req.user = {
      id: user.id,
      company_id: user.company_id,
      company_name: user.company_name || "SISTEMA CENTRAL", 
      full_name: `${user.first_name} ${user.last_name}`.trim(), // 👈 MEJORA AQUÍ
      role: user.role,
      session_id: user.session_id
    };

    next();

  } catch (error) {
    console.error("Error en Auth Middleware:", error);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

/**
 * 🚩 NUEVA MEJORA: Middleware de Autorización para Edición
 * Permite el paso solo a ROOT y ADMIN_CLIENT
 */
export const authorizeEditor = (req, res, next) => {
  const { role } = req.user;
  
  if (role === 'ROOT' || role === 'ADMIN_CLIENT') {
    return next();
  }
  
  return res.status(403).json({ 
    message: "Permisos insuficientes. Solo administradores pueden realizar esta acción." 
  });
};

export default authMiddleware;