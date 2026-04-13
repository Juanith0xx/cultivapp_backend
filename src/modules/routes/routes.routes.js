import { Router } from "express";
import auth from "../../middlewares/auth.js";
import roleGuard from "../../middlewares/roleGuard.js";
import upload from "../../middlewares/upload.js"; 

import {
  createRoute,      
  getRoutes,
  getRoutesByUser,
  deleteRoute,
  checkIn,
  updateRoute,
  getMyTasks,
  resetCheckIn,
  saveVisitPhoto,
  getLiveMonitoring, 
  finishVisit,
  addVisitScan,
  getAttendanceReport // 🚩 Nuevo controlador para el Dashboard
} from "./routes.controller.js";

const router = Router();

/* =========================================================
   1. RUTAS DE MONITOREO Y REPORTES (SUPERVISOR / ADMIN)
========================================================= */

/**
 * 📊 REPORTE DE ASISTENCIA (Control de Jornada)
 * URL: GET /api/routes/attendance-report
 */
router.get(
  "/attendance-report", 
  auth, 
  roleGuard("SUPERVISOR", "ADMIN_CLIENTE", "ROOT"), 
  getAttendanceReport
);

/**
 * 📍 MONITOREO GPS EN TIEMPO REAL (Mapa en vivo)
 */
router.get(
  "/monitoring/live",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"),
  getLiveMonitoring
);

/**
 * 📋 GESTIÓN GENERAL DE RUTAS
 */
router.get(
  "/", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  getRoutes
);

router.post(
  "/", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  createRoute
);

/* =========================================================
   2. OPERACIONES DEL MERCADERISTA (USUARIO)
========================================================= */

// Mi agenda diaria
router.get(
  "/my-tasks", 
  auth, 
  roleGuard("USUARIO", "ADMIN_CLIENTE", "ROOT"), 
  getMyTasks
);

// Check-in con GPS (Actualiza estado a IN_PROGRESS)
router.post(
  "/:id/check-in", 
  auth, 
  roleGuard("USUARIO", "ROOT"), 
  checkIn
);

// Finalizar visita (Check-out)
router.post(
  "/:id/finish",
  auth,
  roleGuard("USUARIO", "ROOT"),
  finishVisit
);

// Evidencia fotográfica
router.post(
  "/:id/photo", 
  auth, 
  roleGuard("USUARIO", "ROOT"), 
  upload.single("foto"), 
  saveVisitPhoto
);

// Escaneo de productos (Barcode)
router.post(
  "/:id/scans",
  auth,
  roleGuard("USUARIO", "ROOT"),
  addVisitScan
);

/* =========================================================
   3. GESTIÓN DINÁMICA (ADMIN / ROOT)
========================================================= */

// Rutas por usuario específico
router.get(
  "/user/:userId", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  getRoutesByUser
);

// Resetear visita a PENDIENTE
router.post(
  "/:id/reset-check-in",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  resetCheckIn
);

// Editar una ruta
router.put(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  updateRoute
);

// Eliminar ruta
router.delete(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  deleteRoute
);

export default router;