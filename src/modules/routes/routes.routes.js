import { Router } from "express";
import auth from "../../middlewares/auth.js";
import roleGuard from "../../middlewares/roleGuard.js";
import upload from "../../middlewares/upload.js"; 

import {
  createRoute,      
  bulkCreate,       // 🚩 IMPORTANTE: Asegúrate de que esta función exista en tu controller
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
  getAttendanceReport 
} from "./routes.controller.js";

const router = Router();

/* =========================================================
   1. GESTIÓN ADMINISTRATIVA (ROOT / ADMIN_CLIENTE)
========================================================= */

/**
 * 🚀 CARGA MASIVA DE RUTAS DESDE EXCEL
 * URL: POST /api/routes/bulk-create
 * Resolvemos el error 404 del frontend
 */
router.post(
  "/bulk-create", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  bulkCreate 
);

/**
 * 📊 REPORTE DE ASISTENCIA
 */
router.get(
  "/attendance-report", 
  auth, 
  roleGuard("SUPERVISOR", "ADMIN_CLIENTE", "ROOT"), 
  getAttendanceReport
);

/**
 * 📍 MONITOREO GPS EN TIEMPO REAL
 */
router.get(
  "/monitoring/live",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"),
  getLiveMonitoring
);

/**
 * 📋 GESTIÓN INDIVIDUAL DE RUTAS
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

router.get(
  "/my-tasks", 
  auth, 
  roleGuard("USUARIO", "ADMIN_CLIENTE", "ROOT"), 
  getMyTasks
);

router.post(
  "/:id/check-in", 
  auth, 
  roleGuard("USUARIO", "ROOT"), 
  checkIn
);

router.post(
  "/:id/finish",
  auth,
  roleGuard("USUARIO", "ROOT"),
  finishVisit
);

router.post(
  "/:id/photo", 
  auth, 
  roleGuard("USUARIO", "ROOT"), 
  upload.single("foto"), 
  saveVisitPhoto
);

router.post(
  "/:id/scans",
  auth,
  roleGuard("USUARIO", "ROOT"),
  addVisitScan
);

/* =========================================================
   3. MANTENIMIENTO Y EDICIÓN
========================================================= */

router.get(
  "/user/:userId", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  getRoutesByUser
);

router.post(
  "/:id/reset-check-in",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  resetCheckIn
);

router.put(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  updateRoute
);

router.delete(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  deleteRoute
);

export default router;