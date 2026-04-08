import { Router } from "express";
import auth from "../../middlewares/auth.js";
import { getChains } from "./chains.controller.js";

const router = Router();

// GET /api/chains?company_id=...
router.get("/", auth, getChains);

export default router;