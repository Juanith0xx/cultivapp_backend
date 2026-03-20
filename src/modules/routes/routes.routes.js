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
  getMyTasks
} from "./routes.controller.js"

const router = Router()

/* =========================================================
   RUTAS DE GESTIÓN (ROOT y ADMIN)
   IMPORTANTE: Las rutas estáticas van SIEMPRE antes que las dinámicas (:id)
========================================================= */

// 🟢 GET: Mi agenda (Mercaderista) - La subimos para que no choque con /:id
router.get(
  "/my-tasks", 
  auth, 
  roleGuard("USUARIO", "ADMIN_CLIENTE", "ROOT"), 
  getMyTasks
)

// 🟢 POST: Crear ruta (Individual o Masiva)
// Definimos ambas para asegurar que el Frontend nunca dé 404
router.post("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), createRoute)
router.post("/bulk", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), createRoute)

// 🟢 GET: Listado general
router.get("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), getRoutes)

// 🟢 GET: Rutas por usuario específico
router.get(
  "/user/:userId", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getRoutesByUser
)

/* =========================================================
   RUTAS DINÁMICAS (Contienen parámetros :id)
   Se dejan al final para evitar que atrapen peticiones de rutas estáticas
========================================================= */

// Check-in con GPS
router.post(
  "/:id/check-in", 
  auth, 
  roleGuard("USUARIO"), 
  checkIn
)

// Editar una ruta o grupo
router.put("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), updateRoute)

// Eliminar ruta o grupo
router.delete("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), deleteRoute)

export default router