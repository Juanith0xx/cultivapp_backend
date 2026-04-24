import { Router } from "express";
import { 
  getDashboardStats, 
  getPhotoAudit, 
  updateVisitPhoto,
  uploadVisitPhotoAction 
} from "./reports.controller.js";
import authenticateToken, { authorizeEditor } from "../../middlewares/auth.js";
import upload from "../../middlewares/upload.js"; 

const router = Router();

// 📊 Rutas existentes
router.get("/dashboard-stats", authenticateToken, getDashboardStats);
router.get("/photos", authenticateToken, getPhotoAudit);
router.put("/photos/:id", authenticateToken, authorizeEditor, updateVisitPhoto);

/**
 * 🚀 SUBIDA DE FOTOS (CORREGIDA)
 * URL Final: POST /api/reports/:visit_id/photo
 */
router.post(
  "/:visit_id/photo", // 🚩 QUITAMOS "/reports" de aquí
  authenticateToken, 
  upload.single("foto"), 
  uploadVisitPhotoAction
);

export default router;