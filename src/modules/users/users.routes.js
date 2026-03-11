import { Router } from "express"
import multer from "multer" // 1. Importar Multer
import path from "path"
import {
  createUser,
  getUsers,
  updateUser,
  toggleUser,
  deleteUser,
  getCompanyStats,
  resetPassword,
  getPublicUserCredential
} from "./users.controller.js"

import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

// 2. Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/') // Asegúrate de que esta carpeta exista en la raíz del backend
  },
  filename: (req, file, cb) => {
    // Guardamos con un nombre único: timestamp + extensión original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage: storage })

const router = Router()

/* =========================================
   RUTAS PÚBLICAS (Sin protección)
========================================= */
router.get("/public/verify/:id", getPublicUserCredential)

/* =========================================
   RUTAS PRIVADAS (Protegidas con Auth)
========================================= */
router.use(auth) 

// 3. Aplicar upload.single('foto') en la ruta POST
// El nombre 'foto' debe coincidir con formData.append("foto", foto) del frontend
router.post("/", roleGuard("ROOT", "ADMIN_CLIENTE"), upload.single('foto'), createUser)

router.get("/", roleGuard("ROOT", "ADMIN_CLIENTE"), getUsers)
router.put("/:id", roleGuard("ROOT", "ADMIN_CLIENTE"), updateUser)
router.patch("/:id/toggle", roleGuard("ROOT", "ADMIN_CLIENTE"), toggleUser)
router.delete("/:id", roleGuard("ROOT", "ADMIN_CLIENTE"), deleteUser)
router.put("/:id/reset-password", roleGuard("ROOT", "ADMIN_CLIENTE"), resetPassword)
router.get("/company/:companyId/stats", roleGuard("ROOT", "ADMIN_CLIENTE"), getCompanyStats)

export default router