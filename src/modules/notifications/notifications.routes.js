import { Router } from "express";
import auth from "../../middlewares/auth.js"; 
import roleGuard from "../../middlewares/roleGuard.js";
import { 
  sendNotification, 
  sendBulkNotifications, 
  getMyNotifications, 
  getSentNotifications,
  markAsRead, 
  markAllAsRead,
  deleteNotification 
} from "./notifications.controller.js";

const router = Router();

// --- 🔔 RUTAS DE CONSULTA (Lo que recibo) ---

/**
 * @route   GET /api/notifications
 * @desc    Obtener notificaciones recibidas por el usuario actual
 */
router.get("/", auth, getMyNotifications);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Marcar todo lo recibido como leído
 */
router.put("/read-all", auth, markAllAsRead);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Marcar una alerta específica como leída
 */
router.put("/:id/read", auth, markAsRead);


// --- 📤 RUTAS DE EMISIÓN Y CONTROL (Lo que envío) ---

/**
 * @route   GET /api/notifications/sent
 * @desc    Obtener historial de notificaciones enviadas
 * @access  ROOT, ADMIN_CLIENTE, SUPERVISOR
 */
router.get(
  "/sent", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  getSentNotifications
);

/**
 * @route   POST /api/notifications/send
 * @desc    Enviar notificación individual o por local
 */
router.post(
  "/send", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  sendNotification
);

/**
 * @route   POST /api/notifications/bulk
 * @desc    Enviar notificaciones masivas (Bulk)
 * 🚩 MEJORA: Se cambió de 'send-bulk' a 'bulk' para coincidir con el Frontend.
 */
router.post(
  "/bulk", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  sendBulkNotifications
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Eliminar una notificación
 * @access  ROOT, ADMIN_CLIENTE, SUPERVISOR
 */
router.delete(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  deleteNotification
);

export default router;