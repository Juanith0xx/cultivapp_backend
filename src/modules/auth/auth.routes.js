import { Router } from "express"
import { login, changePassword } from "./auth.controller.js"
import auth from "../../middlewares/auth.js"

const router = Router()

router.post("/login", login)

// Cambiar contraseña (requiere token)
router.put("/change-password", auth, changePassword)

export default router