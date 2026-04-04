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
import reportsRoutes from "./modules/reports/reports.routes.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

/* =========================================
   CORS CONFIG (OPTIMIZADO PARA DASHBOARD)
========================================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://cultivapp-frontend.vercel.app"
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
   ESTÁTICOS (CORREGIDO PARA SUB-CARPETAS)
========================================= */
// 🚩 IMPORTANTE: 'rootPath' debe apuntar a la raíz donde está la carpeta 'uploads'
const rootPath = path.resolve() 
const uploadsPath = path.join(rootPath, "uploads")

// Asegurar que la carpeta base existe
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
}

/**
 * 📸 MEJORA CRÍTICA: Servir estáticos permitiendo navegación profunda.
 * Esto permitirá que si en la DB guardas: "/cultiva_strategic.../evidencias/foto_gondola/archivo.png"
 * El navegador lo encuentre correctamente en: http://localhost:PORT/uploads/...
 */
app.use("/uploads", express.static(uploadsPath, {
  fallthrough: false, // Si no encuentra el archivo, devuelve 404 en lugar de pasar al siguiente middleware
  setHeaders: (res, filePath) => {
    // Normalizamos para Windows/Linux
    const normalizedPath = filePath.replace(/\\/g, "/")
    
    // Forzar descarga si es documento ACHS
    if (normalizedPath.includes("doc_achs") && normalizedPath.endsWith(".pdf")) {
      res.set("Content-Disposition", "attachment")
      res.set("Content-Type", "application/pdf")
    }
  }
}))

/* =========================================
   DEBUG: INSPECCIÓN DE ARCHIVOS (RECURSIVO)
========================================= */
// 🚩 Actualizado para que puedas ver qué hay dentro de las subcarpetas de empresas
app.get("/api/debug/files", (req, res) => {
  const getFilesRecursively = (dir, fileList = []) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getFilesRecursively(filePath, fileList);
      } else {
        // Guardamos la ruta relativa para comparar con la DB
        fileList.push(filePath.replace(uploadsPath, ""));
      }
    });
    return fileList;
  };

  try {
    if (!fs.existsSync(uploadsPath)) return res.json({ total: 0, message: "No existe uploads" });
    const allFiles = getFilesRecursively(uploadsPath);
    res.json({
      total_fotos: allFiles.length,
      rutas_detectadas: allFiles,
      server_path: uploadsPath
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
app.use("/api/reports", reportsRoutes) 

/* =========================================
   HEALTH CHECK / ERROR HANDLING
========================================= */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "cultivapp-api", timestamp: new Date().toISOString() })
})

app.use((err, req, res, next) => {
  console.error("❌ ERROR SERVER:", err.message)
  res.status(err.status || 500).json({ message: err.message || "Error interno del servidor" })
})

export default app