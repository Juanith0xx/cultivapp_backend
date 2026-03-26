import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

import authRoutes from "./modules/auth/auth.routes.js"
import companiesRoutes from "./modules/companies/companies.routes.js"
import usersRoutes from "./modules/users/users.routes.js"
import localesRoutes from "./modules/locales/locales.routes.js"
import routesRoutes from "./modules/routes/routes.routes.js"

/* NUEVOS MODULOS */
import regionsRoutes from "./modules/regions/regions.routes.js"
import comunasRoutes from "./modules/comunas/comunas.routes.js"
import questionsRoutes from "./modules/questions/questions.routes.js"

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
   BODY PARSER
========================================= */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/* =========================================
   ESTÁTICOS (CONFIGURACIÓN DE DESCARGA FORZADA)
========================================= */
const rootPath = path.resolve() 
const uploadsPath = path.join(rootPath, "uploads")

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
}

/**
 * 🚩 MEJORA: Middleware de estáticos con headers de descarga
 * Si el archivo es un PDF de la carpeta 'doc_achs', forzamos la descarga.
 */
app.use("/uploads", express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // Normalizamos la ruta para que funcione en Windows y Linux
    const normalizedPath = filePath.replace(/\\/g, "/")
    
    if (normalizedPath.includes("doc_achs") && normalizedPath.endsWith(".pdf")) {
      // Content-Disposition: attachment obliga al navegador a descargar el archivo
      res.set("Content-Disposition", "attachment")
      res.set("Content-Type", "application/pdf")
    }
  }
}))

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
    service: "cultivapp-api",
    timestamp: new Date().toISOString()
  })
})

/* =========================================
   MANEJO DE ERRORES GLOBAL
========================================= */
app.use((err, req, res, next) => {
  console.error("❌ ERROR SERVER:", err.message)
  res.status(err.status || 500).json({
    message: err.message || "Error interno del servidor",
  })
})

export default app