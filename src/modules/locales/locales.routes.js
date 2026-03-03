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

router.get(
  "/",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  getLocales
)

router.post(
  "/",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  createLocal
)

router.patch(
  "/:id/toggle",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  toggleLocal
)

router.delete(
  "/:id",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  deleteLocal
)

router.post(
  "/upload",
  auth,
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  upload.single("file"),
  uploadLocales
)

export default router