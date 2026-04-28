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
  getPublicUserCredential,
  updateUserContact,
  bulkCreateUsers // 👈 1. Importamos la nueva función de carga masiva
} from "./users.controller.js"

// 🚩 IMPORTAMOS EL NUEVO CONTROLADOR DE SUPERVISORES
import { getSupervisorLocales, assignLocales } from "./supervisor.controller.js"

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

// 🚩 Configuración para recibir el Excel de carga masiva
const excelUpload = upload.fields([
  { name: "excel", maxCount: 1 }
])

/* --- GESTIÓN DE USUARIOS --- */

router.post(
  "/", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  userUploads, 
  createUser
)

// 🚩 2. NUEVA RUTA: Carga masiva de usuarios desde Excel
router.post(
  "/bulk",
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  excelUpload,
  bulkCreateUsers
)

router.put(
  "/:id", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  userUploads, 
  updateUser
)

// 🚩 NUEVA RUTA: Actualizar contacto (Email/Teléfono)
router.put(
  "/:id/update-contact",
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  updateUserContact
)

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

/* =========================================
   🚩 GESTIÓN DE COBERTURA (SUPERVISORES)
   ========================================= */

// Obtener locales que un supervisor tiene asignados
router.get(
  "/:id/locales", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getSupervisorLocales
)

// Asignar nuevos locales al supervisor
router.post(
  "/:id/assign-locales", 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  assignLocales
)

/* --- ESTADÍSTICAS --- */

router.get(
  "/company/:companyId/stats", 
  roleGuard("ROOT", "ADMIN_CLIENTE", "SUPERVISOR"), 
  getCompanyStats
)

export default router