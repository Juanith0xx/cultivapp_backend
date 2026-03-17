import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"

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
   BODY PARSER (Debe ir antes de las rutas)
========================================= */
app.use(express.json())

/* =========================================
   ESTÁTICOS
========================================= */
app.use("/uploads", express.static(path.join(__dirname, "../uploads")))

/* =========================================
   ROUTES API
========================================= */
// IMPORTANTE: Quitamos el middleware que forzaba el header manualmente
app.use("/api/auth", authRoutes)
app.use("/api/companies", companiesRoutes)
app.use("/api/users", usersRoutes)
app.use("/api/locales", localesRoutes)
app.use("/api/routes", routesRoutes) // <--- Esta es la que usa Juan
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