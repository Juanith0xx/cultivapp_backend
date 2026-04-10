import jwt from "jsonwebtoken";
import pool from "../database/db.js";

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log("\n--- 🕵️ DEBUG INICIO AUTH ---");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("❌ [DEBUG] No hay Header o no empieza con Bearer");
    return res.status(401).json({ message: "No autorizado. Token inexistente." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 1. Verificar firma
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ [DEBUG] Firma válida. Payload:", { id: decoded.id, sub: decoded.sub, session: decoded.session_id });

    const userId = decoded.sub || decoded.id;

    // 2. Buscar en DB
    const result = await pool.query(
      `SELECT id, session_id, is_active, role, company_id FROM public.users WHERE id = $1`,  
      [userId]
    );

    if (result.rows.length === 0) {
      console.log("❌ [DEBUG] Usuario no existe en DB para el ID:", userId);
      return res.status(401).json({ message: "Usuario no existe" });
    }

    const user = result.rows[0];

    // 3. Validar Sesión (ESTO ES LO QUE SUELE FALLAR)
    console.log("🧐 [DEBUG] Comparando Sesiones:");
    console.log("   Token session_id:", decoded.session_id);
    console.log("   DB session_id:   ", user.session_id);

    if (!user.session_id || user.session_id !== decoded.session_id) {
      console.log("❌ [DEBUG] Mismatch de sesión. Rechazado.");
      return res.status(401).json({ message: "Sesión inválida." });
    }

    if (!user.is_active) {
      console.log("❌ [DEBUG] Usuario inactivo.");
      return res.status(401).json({ message: "Cuenta deshabilitada." });
    }

    req.user = { id: user.id, company_id: user.company_id, role: user.role };
    console.log("🚀 [DEBUG] Acceso Concedido.");
    next();

  } catch (error) {
    console.error("❌ [DEBUG ERROR FATAL]:", error.name, "->", error.message);
    return res.status(401).json({ message: "Error de autenticación" });
  }
};

export const authorizeEditor = (req, res, next) => {
  if (!req.user) return res.status(500).json({ message: "Error de servidor" });
  const { role } = req.user;
  if (['ROOT', 'ADMIN_CLIENTE'].includes(role)) return next();
  return res.status(403).json({ message: "Acceso denegado" });
};

export default authMiddleware;