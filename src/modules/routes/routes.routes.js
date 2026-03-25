import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  createRoute,      
  getRoutes,
  getRoutesByUser,
  deleteRoute,
  checkIn,
  updateRoute,
  getMyTasks,
  resetCheckIn // 🚩 Asegúrate de haber agregado esta función al controller
} from "./routes.controller.js"

const router = Router()

/* =========================================================
   1. RUTAS ESTÁTICAS (Sin parámetros :id)
   Deben ir primero para evitar colisiones.
========================================================= */

// Mi agenda (Mercaderista / ROOT para pruebas)
router.get(
  "/my-tasks", 
  auth, 
  roleGuard("USUARIO", "ADMIN_CLIENTE", "ROOT"), 
  getMyTasks
)

// Listado general de rutas (Filtro por empresa o total si es ROOT)
router.get(
  "/", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getRoutes
)

// Crear ruta (Individual o Masiva)
router.post(
  "/", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  createRoute
)

/* =========================================================
   2. RUTAS DINÁMICAS ESPECÍFICAS
========================================================= */

// Rutas por usuario específico (Para la planificación en el Dashboard)
router.get(
  "/user/:userId", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getRoutesByUser
)

// 🔄 NUEVO: Resetear visita a PENDIENTE (Para tus pruebas de una sola línea)
router.post(
  "/:id/reset-check-in",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  resetCheckIn
)

/* =========================================================
   3. OPERACIONES POR ID
========================================================= */

// Check-in con GPS (Permitimos ROOT para que tú puedas testear el flujo)
router.post(
  "/:id/check-in", 
  auth, 
  roleGuard("USUARIO", "ROOT"), 
  checkIn
)

// Editar una ruta o grupo (ROOT incluido para evitar 401)
router.put(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  updateRoute
)

// Eliminar ruta o grupo (🚩 FIX: ROOT ahora tiene permiso explícito)
router.delete(
  "/:id", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  deleteRoute
)

export default router