import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  createRoute,
  getRoutes,
  getRoutesByUser,
  deleteRoute,
  checkIn,
  createBulk,   // <-- Nueva: Para agendar varios días
  updateRoute   // <-- Nueva: Para editar (reasignar, cambiar hora/día)
} from "./routes.controller.js"

const router = Router()

/* =========================================================
   RUTAS DE GESTIÓN (ROOT y ADMIN)
========================================================= */

// Crear ruta individual
router.post("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), createRoute)

// NUEVA: Crear rutas masivas (Días de la semana)
router.post("/bulk", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), createBulk)

// Obtener todas las rutas
router.get("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), getRoutes)

// NUEVA: Editar una ruta existente (Cambiar reponedor, local, hora o día)
router.put("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), updateRoute)

// Eliminar ruta
router.delete("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), deleteRoute)

/* =========================================================
   RUTAS DE OPERACIÓN (USUARIO / MERCADERISTA)
========================================================= */

router.get(
  "/user/:userId", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "USUARIO"), 
  getRoutesByUser
)

router.put(
  "/:id/check-in", 
  auth, 
  roleGuard("USUARIO"), 
  checkIn
)

export default router