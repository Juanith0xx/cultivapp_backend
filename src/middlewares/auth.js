import jwt from "jsonwebtoken";
import pool from "../database/db.js";

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No autorizado. Inicie sesión nuevamente." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 1. Verificar firma
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Compatibilidad: algunos tokens usan 'sub' (estándar Supabase/Auth0) y otros 'id'
    const userId = decoded.sub || decoded.id;
    const tokenSessionId = decoded.session_id || decoded.session;

    if (!userId) {
      console.log("❌ [DEBUG] Token no contiene ID de usuario válido");
      return res.status(401).json({ message: "Token inválido" });
    }

    // 2. Buscar usuario en DB (Fuente de verdad)
    const result = await pool.query(
      `SELECT id, session_id, is_active, role, company_id FROM public.users WHERE id = $1`,  
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Usuario no existe en el sistema" });
    }

    const user = result.rows[0];

    // 3. Validar Sesión Activa
    if (user.session_id && user.session_id !== tokenSessionId) {
      console.log("❌ [DEBUG] Mismatch de sesión. DB:", user.session_id, "Token:", tokenSessionId);
      return res.status(401).json({ message: "Sesión expirada. Re-loguee por favor." });
    }

    if (!user.is_active) {
      return res.status(401).json({ message: "Cuenta deshabilitada" });
    }

    // 4. INYECCIÓN CRÍTICA (Previene el error 400 en controladores)
    // Extraemos la empresa directamente de la DB por seguridad
    req.user = { 
      id: user.id, 
      company_id: user.company_id, // 🚩 VITAL: Aseguramos que viaje al controlador
      role: user.role 
    };

    console.log(`🚀 [AUTH] Acceso OK: User ${user.id} | Company: ${user.company_id}`);
    next();

  } catch (error) {
    console.error("❌ [AUTH ERROR]:", error.name, "->", error.message);
    return res.status(401).json({ message: "Sesión inválida o expirada" });
  }
};

export const authorizeEditor = (req, res, next) => {
  if (!req.user) return res.status(500).json({ message: "Error de servidor en autorización" });
  
  const { role } = req.user;
  // Permitimos ROOT, ADMIN_CLIENTE y SUPERVISOR (ajustado a tu jerarquía)
  const allowedRoles = ['ROOT', 'ADMIN_CLIENTE', 'SUPERVISOR'];
  
  if (allowedRoles.includes(role)) return next();
  
  return res.status(403).json({ message: "No tienes permisos para realizar esta acción" });
};

export default authMiddleware;