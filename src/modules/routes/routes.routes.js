import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  createRoute,      // 🟢 Ahora maneja tanto rutas únicas como masivas
  getRoutes,
  getRoutesByUser,
  deleteRoute,
  checkIn,
  updateRoute,
  getMyTasks
} from "./routes.controller.js"

const router = Router()

/* =========================================================
   RUTAS DE OPERACIÓN (USUARIO / MERCADERISTA)
========================================================= */

// Obtener agenda del día para el mercaderista logueado
router.get(
  "/my-tasks", 
  auth, 
  roleGuard("USUARIO", "ADMIN_CLIENTE", "ROOT"), 
  getMyTasks
)

// Check-in con GPS (Cambiado a POST para recibir coordenadas en el body)
router.post(
  "/:id/check-in", 
  auth, 
  roleGuard("USUARIO"), 
  checkIn
)

/* =========================================================
   RUTAS DE GESTIÓN (ROOT y ADMIN)
========================================================= */

// 🟢 Crear ruta: Soporta individual (por fecha) y masiva (por días) en un solo endpoint
router.post("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), createRoute)

// Obtener todas las rutas generales
router.get("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), getRoutes)

// Obtener rutas de un usuario específico (Vista Admin)
router.get(
  "/user/:userId", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getRoutesByUser
)

// Editar una ruta o grupo de rutas
router.put("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), updateRoute)

// Eliminar ruta o grupo recurrente
router.delete("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), deleteRoute)

export default router