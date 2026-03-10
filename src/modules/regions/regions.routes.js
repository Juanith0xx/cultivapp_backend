import { Router } from "express"
import auth from "../../middlewares/auth.js"

import { getRegions } from "./regions.controller.js"

const router = Router()

router.use(auth)

router.get("/", getRegions)

export default router