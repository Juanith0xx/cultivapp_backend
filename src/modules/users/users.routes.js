import { Router } from "express"
// 🚩 IMPORTANTE: Middleware centralizado para manejo de archivos (S3/Local)
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
   RUTAS PÚBLICAS (Libre acceso)
========================================= */
// Credencial pública para validación mediante código QR
router.get("/public/verify/:id", getPublicUserCredential)

/* =========================================
   RUTAS PRIVADAS (Requieren Token Válido)
========================================= */
router.use(auth) 

/**
 * 🚩 CONFIGURACIÓN MULTI-ARCHIVO
 * Permite la carga simultánea de la foto de perfil y el certificado ACHS/Seguro.
 */
const userUploads = upload.fields([
  { name: "foto", maxCount: 1 },
  { name: "documento_achs", maxCount: 1 }
])

/* --- GESTIÓN DE USUARIOS --- */

// Crear: ROOT crea globalmente / ADMIN crea en su empresa
router.post(
  "/", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  userUploads, 
  createUser
)

// Actualizar: Soporta actualización de archivos y datos de contacto
router.put(
  "/:id", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  userUploads, 
  updateUser
)

/** * 🚩 GET USERS: 
 * RootDashboard.jsx llama a esta ruta. 
 * El controlador DEBE permitir company_id null si req.user.role === 'ROOT'
 */
router.get(
  "/", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getUsers
)

// Activación/Desactivación lógica de cuentas
router.patch(
  "/:id/toggle", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  toggleUser
)

// Eliminación física (restringida a cascada de permisos)
router.delete(
  "/:id", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  deleteUser
)

// Forzar cambio de password desde el panel administrativo
router.put(
  "/:id/reset-password", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  resetPassword
)

/* --- ESTADÍSTICAS --- */

/**
 * 🚩 COMPANY STATS:
 * Utilizada por AdminOverview y Analytics para ver límites de licencias.
 */
router.get(
  "/company/:companyId/stats", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getCompanyStats
)

export default router