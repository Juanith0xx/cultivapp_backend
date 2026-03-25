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
 * @desc    Obtener lista de empresas (ROOT ve todas, ADMIN_CLIENTE ve la suya)
 * @access  Private (ROOT, ADMIN_CLIENTE)
 */
router.get("/", 
  auth, 
  // CAMBIO AQUÍ: Permitimos que ADMIN_CLIENTE también entre a esta ruta
  roleGuard("ROOT", "ADMIN_CLIENTE"), 
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
  roleGuard("ROOT"), // Este se queda solo para ROOT por seguridad
  createCompanyWithAdmin
)

/**
 * @route   PATCH /api/companies/:id/toggle
 * @desc    Activar o desactivar una empresa
 * @access  Private (ROOT)
 */
router.patch(
  "/:id/toggle",
  auth,
  roleGuard("ROOT"), // Este también solo para ROOT
  toggleCompany
)

export default router