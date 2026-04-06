import { Router } from "express";
import auth from "../../middlewares/auth.js"; // Tu middleware de protección
import roleGuard from "../../middlewares/roleGuard.js";
import { sendNotification, getMyNotifications } from "./notifications.controller.js";

const router = Router();

// Esta es la ruta que da 404 si no está aquí:
router.post("/send", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), sendNotification);

// Esta es la que usa la campana para ver el historial:
router.get("/", auth, getMyNotifications);

export default router;