import { Router } from "express";
import { getPhotoAudit, updateVisitPhoto } from "./reports.controller.js";
// 🚩 Importamos tanto el middleware de autenticación como el de autorización
import authenticateToken, { authorizeEditor } from "../../middlewares/auth.js";

const router = Router();

/**
 * 📸 RUTA: Obtener Auditoría Fotográfica
 * Acceso: Cualquier usuario autenticado (el controlador filtra por empresa internamente)
 */
router.get("/photos", authenticateToken, getPhotoAudit);

/**
 * 📝 RUTA: Modificar Datos de una Visita/Foto
 * Acceso: Restringido a ROOT y ADMIN_CLIENT
 * Se usa 'authenticateToken' primero para identificar al usuario
 * y luego 'authorizeEditor' para validar sus permisos de edición.
 */
router.put("/photos/:id", authenticateToken, authorizeEditor, updateVisitPhoto);

export default router;