import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  createRoute,
  getRoutes,
  getRoutesByUser,
  deleteRoute,
  checkIn // <-- Importamos la nueva función
} from "./routes.controller.js"

const router = Router()

/* =========================================================
   RUTAS DE GESTIÓN (ROOT y ADMIN)
========================================================= */
router.post("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), createRoute)
router.get("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), getRoutes)
router.delete("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), deleteRoute)

/* =========================================================
   RUTAS DE OPERACIÓN (USUARIO / MERCADERISTA)
========================================================= */

// CORRECCIÓN: Permitimos que el USUARIO también acceda a sus propias rutas
router.get(
  "/user/:userId", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE", "USUARIO"), 
  getRoutesByUser
)

// NUEVA: Ruta para que el usuario marque el inicio de su visita
router.put(
  "/:id/check-in", 
  auth, 
  roleGuard("USUARIO"), 
  checkIn
)

export default router