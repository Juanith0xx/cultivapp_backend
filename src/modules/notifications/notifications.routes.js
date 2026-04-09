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
 * @desc    Obtener historial de notificaciones enviadas (Para el Manager)
 * @access  ROOT, ADMIN_CLIENTE
 */
router.get("/sent", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), getSentNotifications);

/**
 * @route   POST /api/notifications/send
 * @desc    Enviar notificación individual o por local
 */
router.post("/send", auth, roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), sendNotification);

/**
 * @route   POST /api/notifications/send-bulk
 * @desc    Enviar notificaciones masivas (Bulk)
 */
router.post("/send-bulk", auth, roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), sendBulkNotifications);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Eliminar una notificación (Remitente o ROOT)
 * @access  ROOT, ADMIN_CLIENTE
 */
router.delete("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), deleteNotification);

export default router;