import { Router } from "express"
import upload from "../../middlewares/upload.js" 

import {
  createUser,
  getUsers,
  updateUser,
  toggleUser,
  deleteUser,
  getCompanyStats,
  resetPassword,
  getPublicUserCredential
} from "./users.controller.js"

import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

const router = Router()

/* =========================================
   RUTAS PÚBLICAS
========================================= */
router.get("/public/verify/:id", getPublicUserCredential)

/* =========================================
   RUTAS PRIVADAS
========================================= */
router.use(auth) 

const userUploads = upload.fields([
  { name: "foto", maxCount: 1 },
  { name: "documento_achs", maxCount: 1 }
])

/* --- GESTIÓN DE USUARIOS --- */

router.post(
  "/", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  userUploads, 
  createUser
)

router.put(
  "/:id", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  userUploads, 
  updateUser
)

/** * 🚩 GET USERS (ACTUALIZADA): 
 * Ahora incluimos "SUPERVISOR" para que el AlertManager pueda listar al personal.
 */
router.get(
  "/", 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  getUsers
)

router.patch(
  "/:id/toggle", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  toggleUser
)

router.delete(
  "/:id", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  deleteUser
)

router.put(
  "/:id/reset-password", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  resetPassword
)

/* --- ESTADÍSTICAS --- */

router.get(
  "/company/:companyId/stats", 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), // 🚩 También añadimos aquí por si necesitas ver métricas en el Panel de Cobertura
  getCompanyStats
)

export default router