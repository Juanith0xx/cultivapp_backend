import { Router } from "express"
import {
  createUser,
  getUsers,
  updateUser,
  toggleUser,
  deleteUser,
  getCompanyStats,
  resetPassword
} from "./users.controller.js"

import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

const router = Router()

router.post("/", auth, roleGuard("ROOT","ADMIN_CLIENTE"), createUser)
router.get("/", auth, roleGuard("ROOT","ADMIN_CLIENTE"), getUsers)
router.put("/:id", auth, roleGuard("ROOT","ADMIN_CLIENTE"), updateUser)
router.patch("/:id/toggle", auth, roleGuard("ROOT","ADMIN_CLIENTE"), toggleUser)
router.delete("/:id", auth, roleGuard("ROOT","ADMIN_CLIENTE"), deleteUser)
router.put("/:id/reset-password", auth, roleGuard("ROOT","ADMIN_CLIENTE"), resetPassword)
router.get("/company/:companyId/stats", auth, roleGuard("ROOT","ADMIN_CLIENTE"), getCompanyStats)

export default router