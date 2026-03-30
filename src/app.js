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
   BODY PARSER (LÍMITES AUMENTADOS PARA OFFLINE)
========================================= */
// 🚩 MEJORA: Aumentamos a 50mb para que las ráfagas de fotos sincronizadas no den error
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

/* =========================================
   ESTÁTICOS (CONFIGURACIÓN DE DESCARGA FORZADA)
========================================= */
const rootPath = path.resolve() 
const uploadsPath = path.join(rootPath, "uploads")

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
}

app.use("/uploads", express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    const normalizedPath = filePath.replace(/\\/g, "/")
    if (normalizedPath.includes("doc_achs") && normalizedPath.endsWith(".pdf")) {
      res.set("Content-Disposition", "attachment")
      res.set("Content-Type", "application/pdf")
    }
  }
}))

/* =========================================
   DEBUG: INSPECCIÓN DE ARCHIVOS (PARA RENDER FREE)
========================================= */
/**
 * 🚩 NUEVA RUTA: Permite ver si las fotos se guardaron realmente.
 * Accede a: https://tu-backend.onrender.com/api/debug/files
 */
app.get("/api/debug/files", (req, res) => {
  if (!fs.existsSync(uploadsPath)) {
    return res.json({ message: "La carpeta uploads no existe aún.", total: 0 });
  }

  fs.readdir(uploadsPath, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Filtramos para ignorar archivos ocultos si los hay
    const fileList = files.filter(f => !f.startsWith('.'));
    
    res.json({
      total_fotos: fileList.length,
      archivos: fileList,
      timestamp: new Date().toISOString()
    });
  });
});

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