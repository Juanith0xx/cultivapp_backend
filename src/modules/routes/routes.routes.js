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
  getLiveMonitoring, // 📍 Nueva mejora para el Mapa
  finishVisit        // ✅ Nueva mejora para cerrar visita
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

// 📍 NUEVO: Monitoreo GPS en tiempo real (Para el mapa del Admin)
// Nota: En el frontend llamar como: api.get("/routes/monitoring/live")
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

// 📸 Subir evidencia fotográfica
router.post(
  "/photos", 
  auth, 
  roleGuard("USUARIO", "ROOT"), 
  upload.single("photo"), 
  saveVisitPhoto
)

// ✅ NUEVO: Finalizar visita (Check-out)
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