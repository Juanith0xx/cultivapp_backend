import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  getCompanies,
  createCompanyWithAdmin,
  toggleCompany
} from "./companies.controller.js"

const router = Router()

/**
 * @route   GET /api/companies
 * @desc    Obtener lista de todas las empresas (Solo ROOT)
 * @access  Private (ROOT)
 */
router.get("/", 
  auth, 
  roleGuard("ROOT"), 
  getCompanies
)

/**
 * @route   POST /api/companies/with-admin
 * @desc    Crear una nueva empresa junto con su primer usuario Administrador
 * @access  Private (ROOT)
 */
router.post(
  "/with-admin",
  auth,
  roleGuard("ROOT"),
  createCompanyWithAdmin
)

/**
 * @route   PATCH /api/companies/:id/toggle
 * @desc    Activar o desactivar una empresa (Bloquea acceso a todos sus usuarios)
 * @access  Private (ROOT)
 */
router.patch(
  "/:id/toggle",
  auth,
  roleGuard("ROOT"),
  toggleCompany
)

export default router