import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  getCompanies,
  createCompanyWithAdmin,
  toggleCompany,
  updateCompanyPlan,
  deleteCompany // 👈 1. Importamos la función de borrado
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
 */
router.post(
  "/with-admin",
  auth,
  roleGuard("ROOT"),
  createCompanyWithAdmin
)

/**
 * @route   PATCH /api/companies/:id/toggle
 */
router.patch(
  "/:id/toggle",
  auth,
  roleGuard("ROOT"),
  toggleCompany
)

/**
 * @route   PATCH /api/companies/:id
 * @desc    Actualizar los límites del plan (Cuotas de usuarios)
 * @access  Private (ROOT)
 */
router.patch(
  "/:id",
  auth,
  roleGuard("ROOT"),
  updateCompanyPlan
)

/**
 * @route   DELETE /api/companies/:id
 * @desc    Eliminar empresa (Soft Delete)
 * @access  Private (ROOT)
 */
router.delete(
  "/:id",
  auth,
  roleGuard("ROOT"), // 🚩 Solo ROOT puede realizar esta acción
  deleteCompany      // 👈 2. Registramos la ruta para eliminar
)

export default router