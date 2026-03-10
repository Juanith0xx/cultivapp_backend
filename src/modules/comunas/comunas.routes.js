import { Router } from "express"
import auth from "../../middlewares/auth.js"

import { getComunas } from "./comunas.controller.js"

const router = Router()

router.use(auth)

router.get("/", getComunas)

export default router