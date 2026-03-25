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
   MIDDLEWARE DE AUTENTICACIÓN (Obligatorio para todos)
========================================= */
router.use(auth)

/* =========================================
   OBTENER LOCALES 
   (🔓 Quitamos el roleGuard global para que el USUARIO pueda verlos)
========================================= */
router.get(
  "/",
  getLocales
)

/* =========================================
   ACCIONES PROTEGIDAS 
   (🔒 Solo ROOT y ADMIN_CLIENTE pueden modificar)
========================================= */

router.post(
  "/",
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  createLocal
)

router.put(
  "/:id",
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  updateLocal
)

router.patch(
  "/:id/toggle",
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  toggleLocal
)

router.delete(
  "/:id",
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  deleteLocal
)

/* =========================================
   CARGA MASIVA EXCEL
========================================= */
router.post(
  "/upload",
  roleGuard("ROOT", "ADMIN_CLIENTE"),
  upload.single("file"),
  uploadLocales
)

export default router