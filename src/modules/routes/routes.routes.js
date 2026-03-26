import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"
import upload from "../../middlewares/upload.js" 

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
  addVisitScan // 🚩 IMPORTANTE: Agregamos la nueva función del controlador
} from "./routes.controller.js"

const router = Router()

/* =========================================================
   1. RUTAS ESTÁTICAS (Sin parámetros :id)
========================================================= */

// Mi agenda (Mercaderista / ROOT para pruebas)
router.get(
  "/my-tasks", 
  auth, 
  roleGuard("USUARIO", "ADMIN_CLIENTE", "ROOT"), 
  getMyTasks
)

// 📍 Monitoreo GPS en tiempo real (Para el mapa del Admin)
router.get(
  "/monitoring/live",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  getLiveMonitoring
)

// Listado general de rutas
router.get(
  "/", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getRoutes
)

// Crear ruta
router.post(
  "/", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  createRoute
)

/* =========================================================
   2. RUTAS DINÁMICAS ESPECÍFICAS
========================================================= */

// Rutas por usuario específico
router.get(
  "/user/:userId", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getRoutesByUser
)

// Resetear visita a PENDIENTE
router.post(
  "/:id/reset-check-in",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  resetCheckIn
)

/* =========================================================
   3. OPERACIONES POR ID Y EVIDENCIAS
========================================================= */

/**
 * 📸 EVIDENCIA FOTOGRÁFICA (MEJORADA PARA SAAS)
 * URL: POST /api/routes/:id/photo
 */
router.post(
  "/:id/photo", 
  auth, 
  roleGuard("USUARIO", "ROOT"), 
  upload.single("foto"), 
  saveVisitPhoto
)

/**
 * 🛒 REGISTRO DE ESCANEO DE PRODUCTOS (EAN/BARCODE)
 * URL: POST /api/routes/:id/scans
 * Esta es la ruta que tu iPhone está buscando y daba Error 404
 */
router.post(
  "/:id/scans",
  auth,
  roleGuard("USUARIO", "ROOT"),
  addVisitScan // 🚩 Llamamos a la lógica para guardar en public.visit_scans
)

// ✅ Finalizar visita (Check-out)
router.post(
  "/:id/finish",
  auth,
  roleGuard("USUARIO", "ROOT"),
  finishVisit
)

// Check-in con GPS
router.post(
  "/:id/check-in", 
  auth, 
  roleGuard("USUARIO", "ROOT"), 
  checkIn
)

// Editar una ruta
router.put(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  updateRoute
)

// Eliminar ruta
router.delete(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  deleteRoute
)

export default router