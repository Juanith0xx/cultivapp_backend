import express from "express"
import cors from "cors"
import path from "path" // 1. Importar path
import { fileURLToPath } from "url" // Necesario para ES Modules

import authRoutes from "./modules/auth/auth.routes.js"
import companiesRoutes from "./modules/companies/companies.routes.js"
import usersRoutes from "./modules/users/users.routes.js"
import localesRoutes from "./modules/locales/locales.routes.js"
import routesRoutes from "./modules/routes/routes.routes.js"

/* NUEVOS MODULOS */
import regionsRoutes from "./modules/regions/regions.routes.js"
import comunasRoutes from "./modules/comunas/comunas.routes.js"
import questionsRoutes from "./modules/questions/questions.routes.js"

// Configuración para obtener la ruta de la carpeta raíz
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

/* =========================================
   CORS CONFIG
========================================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://cultivapp-frontend.vercel.app"
    ],
    credentials: true
  })
)

/* =========================================
   ESTÁTICOS (ESTO ES LO QUE FALTA)
   Permite que las fotos se vean en el navegador
========================================= */
// Si la carpeta uploads está en la raíz (fuera de src) usamos '../uploads'
app.use("/uploads", express.static(path.join(__dirname, "../uploads")))

/* =========================================
   BODY PARSER
========================================= */
app.use(express.json())

/* =========================================
   FORZAR UTF-8 EN RESPUESTAS
   Nota: Quitamos el header global aquí porque express.static 
   necesita manejar sus propios content-types (image/jpeg, etc.)
========================================= */
app.use("/api", (req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  next()
})

/* =========================================
   ROUTES API
========================================= */
app.use("/api/auth", authRoutes)
app.use("/api/companies", companiesRoutes)
app.use("/api/users", usersRoutes)
app.use("/api/locales", localesRoutes)
app.use("/api/routes", routesRoutes)
app.use("/api/regions", regionsRoutes)
app.use("/api/comunas", comunasRoutes)
app.use("/api/questions", questionsRoutes)

/* =========================================
   HEALTH CHECK
========================================= */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "cultivapp-api"
  })
})

export default app