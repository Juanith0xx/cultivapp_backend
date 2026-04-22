import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  getCompanies,
  createCompanyWithAdmin,
  toggleCompany,
  updateCompanyPlan,
  deleteCompany 
} from "./companies.controller.js"

const router = Router()

/**
 * @route   GET /api/companies
 */
router.get("/", 
  auth, 
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
  getCompanies
)

/**
 * @route   POST /api/companies/with-admin
 * 🚩 Mejora: Permitimos ADMIN_CLIENTE para que Cultiva Admin pueda entrar
 */
router.post(
  "/with-admin",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  createCompanyWithAdmin
)

/**
 * @route   PATCH /api/companies/:id/toggle
 * 🚩 Mejora: Acceso para togglear estados habilitado para el portero
 */
router.patch(
  "/:id/toggle",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  toggleCompany
)

/**
 * @route   PATCH /api/companies/:id
 * @desc    Actualizar los límites del plan (Cuotas de usuarios)
 * 🚩 Mejora: Permitimos el paso al controlador para validar ID de Cultiva
 */
router.patch(
  "/:id",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  updateCompanyPlan
)

/**
 * @route   DELETE /api/companies/:id
 * @desc    Eliminar empresa (Soft Delete)
 * 🔒 Nota: Mantenemos solo ROOT aquí por máxima seguridad, 
 * o puedes añadir ADMIN_CLIENTE si quieres que Cultiva también borre.
 */
router.delete(
  "/:id",
  auth,
  roleGuard("ROOT"), 
  deleteCompany      
)

export default router