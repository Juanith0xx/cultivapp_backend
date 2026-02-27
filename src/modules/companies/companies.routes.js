import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  getCompanies,
  createCompanyWithAdmin,
  toggleCompany
} from "./companies.controller.js"

const router = Router()

router.get("/", auth, roleGuard("ROOT"), getCompanies)

router.post(
  "/with-admin",
  auth,
  roleGuard("ROOT"),
  createCompanyWithAdmin
)

router.patch(
  "/:id/toggle",
  auth,
  roleGuard("ROOT"),
  toggleCompany
)

export default router