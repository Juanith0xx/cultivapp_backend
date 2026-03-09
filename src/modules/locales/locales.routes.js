import { Router } from "express"

import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"
import upload from "../../middlewares/upload.js"

import {
  getLocales,
  createLocal,
  updateLocal,
  toggleLocal,
  deleteLocal,
  uploadLocales
} from "./locales.controller.js"

const router = Router()

/* =========================================
   MIDDLEWARE GLOBAL DEL MODULO
========================================= */

router.use(auth)
router.use(roleGuard("ROOT", "ADMIN_CLIENTE"))

/* =========================================
   OBTENER LOCALES
========================================= */

router.get(
  "/",
  getLocales
)

/* =========================================
   CREAR LOCAL
========================================= */

router.post(
  "/",
  createLocal
)

/* =========================================
   ACTUALIZAR LOCAL
========================================= */

router.put(
  "/:id",
  updateLocal
)

/* =========================================
   TOGGLE LOCAL
========================================= */

router.patch(
  "/:id/toggle",
  toggleLocal
)

/* =========================================
   ELIMINAR LOCAL
========================================= */

router.delete(
  "/:id",
  deleteLocal
)

/* =========================================
   CARGA MASIVA EXCEL
========================================= */

router.post(
  "/upload",
  upload.single("file"),
  uploadLocales
)

export default router