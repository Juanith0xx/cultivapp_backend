import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  getCompanies,
  createCompanyWithAdmin,
  toggleCompany,
  updateCompanyPlan // 👈 Importamos la nueva función
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
  updateCompanyPlan // 👈 Esta es la ruta que resuelve el error "Cannot PATCH"
)

export default router