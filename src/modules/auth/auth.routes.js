import { Router } from "express"
import { 
  login, 
  changePassword,
  forgotPassword,
  resetPassword,
} from "./auth.controller.js"

import auth from "../../middlewares/auth.js"

const router = Router()

/* ===============================
   AUTH
=============================== */
router.post("/login", login)
router.put("/change-password", auth, changePassword)

/* ===============================
   PASSWORD RESET SaaS
=============================== */
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)

/* ===============================
   TEST EMAIL (TEMPORAL)
=============================== */
/*router.get("/test-email", testEmail)*/

export default router