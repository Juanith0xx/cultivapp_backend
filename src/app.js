import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

/* IMPORTACIÓN DE RUTAS */
import authRoutes from "./modules/auth/auth.routes.js"
import companiesRoutes from "./modules/companies/companies.routes.js"
import usersRoutes from "./modules/users/users.routes.js"
import localesRoutes from "./modules/locales/locales.routes.js"
import routesRoutes from "./modules/routes/routes.routes.js"
import regionsRoutes from "./modules/regions/regions.routes.js"
import comunasRoutes from "./modules/comunas/comunas.routes.js" 
import questionsRoutes from "./modules/questions/questions.routes.js"
import reportsRoutes from "./modules/reports/reports.routes.js"
import notificationsRoutes from "./modules/notifications/notifications.routes.js" 
import chainsRoutes from "./modules/chains/chains.routes.js"
import turnosRoutes from "./modules/turnos/turnos.routes.js" 

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

/* =========================================
   CORS CONFIG (PRODUCCIÓN & LOCAL)
========================================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://cultivapp-frontend.vercel.app",
      /\.railway\.app$/ 
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200 
  })
)

app.options(/.*/, cors()); 

/* =========================================
   BODY PARSER
========================================= */
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

/* =========================================
   ESTÁTICOS: GESTIÓN DE UPLOADS
========================================= */
const rootPath = path.resolve() 
const uploadsPath = path.join(rootPath, "uploads")

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
}

app.use("/uploads", express.static(uploadsPath, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    const normalizedPath = filePath.replace(/\\/g, "/")
    if (normalizedPath.includes("doc_achs") && normalizedPath.endsWith(".pdf")) {
      res.set("Content-Disposition", "attachment")
    }
  }
}))

/* =========================================
   API ROUTES
========================================= */
app.use("/api/auth", authRoutes)
app.use("/api/companies", companiesRoutes)
app.use("/api/users", usersRoutes)
app.use("/api/locales", localesRoutes)
app.use("/api/routes", routesRoutes)
app.use("/api/regions", regionsRoutes)
app.use("/api/comunas", comunasRoutes)
app.use("/api/questions", questionsRoutes)
app.use("/api/reports", reportsRoutes) // 🚩 ESTA RUTA ESTÁ CORRECTA
app.use("/api/notifications", notificationsRoutes)
app.use("/api/chains", chainsRoutes)
app.use("/api/turnos-config", turnosRoutes) 

/* =========================================
   HEALTH & ERRORS
========================================= */
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "cultivapp-api", 
    environment: process.env.NODE_ENV || 'development',
    storage_connected: fs.existsSync(uploadsPath)
  })
})

app.use((err, req, res, next) => {
  console.error("❌ ERROR SERVER:", err.message)
  res.status(err.status || 500).json({ 
    message: err.message || "Error interno del servidor",
    error: process.env.NODE_ENV === 'development' ? err : {} 
  })
})

export default app