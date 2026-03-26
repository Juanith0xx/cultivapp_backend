import { Router } from "express"
// 🚩 IMPORTANTE: Importamos el middleware centralizado que tiene la lógica de carpetas
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
   RUTAS PÚBLICAS (Sin protección)
========================================= */
router.get("/public/verify/:id", getPublicUserCredential)

/* =========================================
   RUTAS PRIVADAS (Protegidas con Auth)
========================================= */
router.use(auth) 

/**
 * 🚩 MEJORA: Configuración de campos de archivo
 * Esto permite subir 'foto' y 'documento_achs' en la misma petición.
 */
const userUploads = upload.fields([
  { name: "foto", maxCount: 1 },
  { name: "documento_achs", maxCount: 1 }
])

// Crear usuario con soporte para múltiples archivos
router.post(
  "/", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  userUploads, 
  createUser
)

// Actualizar usuario con soporte para múltiples archivos
router.put(
  "/:id", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  userUploads, 
  updateUser
)

router.get("/", roleGuard("ROOT", "ADMIN_CLIENTE"), getUsers)
router.patch("/:id/toggle", roleGuard("ROOT", "ADMIN_CLIENTE"), toggleUser)
router.delete("/:id", roleGuard("ROOT", "ADMIN_CLIENTE"), deleteUser)
router.put("/:id/reset-password", roleGuard("ROOT", "ADMIN_CLIENTE"), resetPassword)
router.get("/company/:companyId/stats", roleGuard("ROOT", "ADMIN_CLIENTE"), getCompanyStats)

export default router