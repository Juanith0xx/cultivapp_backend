import express from "express"
import cors from "cors"

import authRoutes from "./modules/auth/auth.routes.js"
import companiesRoutes from "./modules/companies/companies.routes.js"
import usersRoutes from "./modules/users/users.routes.js"
import localesRoutes from "./modules/locales/locales.routes.js"
import routesRoutes from "./modules/routes/routes.routes.js"

/* NUEVOS MODULOS */
import regionsRoutes from "./modules/regions/regions.routes.js"
import comunasRoutes from "./modules/comunas/comunas.routes.js"

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

/* =========================================
   FORZAR UTF-8 EN RESPUESTAS
========================================= */

app.use((req, res, next) => {
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

/* =========================================
   NUEVAS RUTAS GEOGRÁFICAS
========================================= */

app.use("/api/regions", regionsRoutes)
app.use("/api/comunas", comunasRoutes)

/* =========================================
   HEALTH CHECK (BUENA PRACTICA)
========================================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "cultivapp-api"
  })
})

export default app