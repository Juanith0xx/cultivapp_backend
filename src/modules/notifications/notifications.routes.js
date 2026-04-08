import { Router } from "express";
import auth from "../../middlewares/auth.js"; 
import roleGuard from "../../middlewares/roleGuard.js";
import { 
  sendNotification, 
  sendBulkNotifications, // 🔥 Nueva mejora: Importamos la lógica masiva
  getMyNotifications, 
  markAsRead, 
  markAllAsRead 
} from "./notifications.controller.js";

const router = Router();

// --- RUTAS DE CONSULTA Y GESTIÓN (Para todos los roles) ---

/**
 * @route   GET /api/notifications
 * @desc    Obtener historial de alertas del usuario autenticado
 */
router.get("/", auth, getMyNotifications);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Marcar una alerta específica como leída
 */
router.put("/:id/read", auth, markAsRead);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Marcar todas las alertas del usuario como leídas
 */
router.put("/read-all", auth, markAllAsRead);


// --- RUTAS DE EMISIÓN (Solo roles con autoridad) ---

/**
 * @route   POST /api/notifications/send
 * @desc    Enviar notificación a un usuario específico
 * @access  ROOT, ADMIN_CLIENTE, SUPERVISOR
 */
router.post("/send", auth, roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), sendNotification);

/**
 * @route   POST /api/notifications/send-bulk
 * @desc    Enviar notificaciones masivas (ej: de ROOT a todos los ADMIN_CLIENTE)
 * @access  Solo ROOT
 */
router.post("/send-bulk", auth, roleGuard("ROOT"), sendBulkNotifications);

export default router;