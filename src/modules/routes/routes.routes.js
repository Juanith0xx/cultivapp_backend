import { Router } from "express"
import auth from "../../middlewares/auth.js"
import roleGuard from "../../middlewares/roleGuard.js"

import {
  createRoute,
  getRoutes,
  getRoutesByUser,
  deleteRoute
} from "./routes.controller.js"

const router = Router()

// ROOT y ADMIN_CLIENTE pueden operar
router.post("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), createRoute)
router.get("/", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), getRoutes)
router.get("/user/:userId", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), getRoutesByUser)
router.delete("/:id", auth, roleGuard("ROOT", "ADMIN_CLIENTE"), deleteRoute)

export default router