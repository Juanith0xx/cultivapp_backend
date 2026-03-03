import { Router } from "express"
import { 
  login, 
  changePassword,
  forgotPassword,
  resetPassword
} from "./auth.controller.js"
import auth from "../../middlewares/auth.js"

const router = Router()

router.post("/login", login)
router.put("/change-password", auth, changePassword)

// NUEVAS RUTAS SaaS
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)

export default router