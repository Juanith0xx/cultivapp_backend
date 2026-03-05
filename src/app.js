import express from "express"
import cors from "cors"

import authRoutes from "./modules/auth/auth.routes.js"
import companiesRoutes from "./modules/companies/companies.routes.js"
import usersRoutes from "./modules/users/users.routes.js"
import localesRoutes from "./modules/locales/locales.routes.js"
import routesRoutes from "./modules/routes/routes.routes.js"

const app = express()

/* CORS CONFIG */
app.use(
  cors({
    origin: [
      "http://localhost:5173", // desarrollo local
      "https://cultivapp-frontend.vercel.app" // producción vercel
    ],
    credentials: true
  })
)

/* BODY PARSER */
app.use(express.json())

/* ROUTES */
app.use("/api/auth", authRoutes)
app.use("/api/companies", companiesRoutes)
app.use("/api/users", usersRoutes)
app.use("/api/locales", localesRoutes)
app.use("/api/routes", routesRoutes)

export default app