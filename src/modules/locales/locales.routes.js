import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"
import upload from "../../middlewares/upload.js"

import {
  getLocales,
  createLocal,
  toggleLocal,
  deleteLocal,
  uploadLocales
} from "./locales.controller.js"

const router = Router()

/* =========================================
   ROOT - CONTROL TOTAL LOCALES
========================================= */

router.get("/", auth, roleGuard("ROOT"), getLocales)

router.post("/", auth, roleGuard("ROOT"), createLocal)

router.patch("/:id/toggle", auth, roleGuard("ROOT"), toggleLocal)

router.delete("/:id", auth, roleGuard("ROOT"), deleteLocal)

router.post(
  "/upload",
  auth,
  roleGuard("ROOT"),
  upload.single("file"),
  uploadLocales
)

export default router