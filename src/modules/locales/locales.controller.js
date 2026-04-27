import * as localeService from "./locales.services.js";
import fs from "fs"; // 🚩 Importante para leer el archivo del disco
import path from "path";

/* =========================================
   OBTENER LOCALES
========================================= */
export const getLocales = async (req, res) => {
  try {
    let companyId = req.query.company_id;

    if (req.user.role === "ADMIN_CLIENTE") {
      companyId = req.user.company_id;
    }

    const locales = await localeService.getLocales(companyId);
    res.json(locales);

  } catch (error) {
    console.error("❌ GET LOCALES ERROR:", error.message);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   🚩 OBTENER LOCALES POR SUPERVISOR (NUEVO)
   Resuelve el error de importación en locales.routes.js
========================================= */
export const getLocalesBySupervisor = async (req, res) => {
  try {
    const { supervisor_id } = req.params;
    
    if (!supervisor_id) {
      return res.status(400).json({ message: "ID de supervisor requerido" });
    }

    const locales = await localeService.getLocalesBySupervisor(supervisor_id);
    res.json(locales);

  } catch (error) {
    console.error("❌ GET LOCALES BY SUPERVISOR ERROR:", error.message);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   CREAR LOCAL
========================================= */
export const createLocal = async (req, res) => {
  try {
    let payload = { ...req.body };

    if (req.user.role === "ADMIN_CLIENTE") {
      payload.company_id = req.user.company_id;
    }

    const local = await localeService.createLocal(payload);
    res.status(201).json(local);

  } catch (error) {
    console.error("❌ CREATE LOCAL ERROR:", error.message);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   ACTUALIZAR LOCAL
========================================= */
export const updateLocal = async (req, res) => {
  try {
    const { id } = req.params;
    const local = await localeService.getLocalById(id);

    if (!local) {
      return res.status(404).json({ message: "Local no encontrado" });
    }

    if (req.user.role === "ADMIN_CLIENTE" && local.company_id !== req.user.company_id) {
      return res.status(403).json({ message: "Sin permisos" });
    }

    const updated = await localeService.updateLocal(id, req.body);
    res.json(updated);

  } catch (error) {
    console.error("❌ UPDATE LOCAL ERROR:", error.message);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   TOGGLE LOCAL
========================================= */
export const toggleLocal = async (req, res) => {
  try {
    const local = await localeService.getLocalById(req.params.id);

    if (!local) return res.status(404).json({ message: "Local no encontrado" });

    if (req.user.role === "ADMIN_CLIENTE" && local.company_id !== req.user.company_id) {
      return res.status(403).json({ message: "Sin permisos" });
    }

    const updated = await localeService.toggleLocal(req.params.id);
    res.json(updated);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   ELIMINAR LOCAL
========================================= */
export const deleteLocal = async (req, res) => {
  try {
    const local = await localeService.getLocalById(req.params.id);

    if (!local) return res.status(404).json({ message: "Local no encontrado" });

    if (req.user.role === "ADMIN_CLIENTE" && local.company_id !== req.user.company_id) {
      return res.status(403).json({ message: "Sin permisos" });
    }

    await localeService.deleteLocal(req.params.id);
    res.json({ message: "Local eliminado correctamente" });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   CARGA MASIVA EXCEL (CORREGIDO Y MEJORADO)
========================================= */
export const uploadLocales = async (req, res) => {
  try {
    // 1. Validar archivo
    if (!req.file) {
      return res.status(400).json({ message: "Archivo Excel requerido (.xlsx o .xls)" });
    }

    // 2. Definir ID de empresa
    let companyId = req.body.company_id;
    if (req.user.role === "ADMIN_CLIENTE") {
      companyId = req.user.company_id;
    }

    if (!companyId) {
      // Si falla, borramos el archivo para no dejar basura
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "ID de empresa es obligatorio" });
    }

    // 🚩 3. LEER EL ARCHIVO DESDE EL DISCO
    const fileBuffer = fs.readFileSync(req.file.path);

    // 4. Procesar en el servicio
    const result = await localeService.uploadLocalesFromExcel(
      fileBuffer,
      companyId
    );

    // 🚩 5. LIMPIEZA: Borrar archivo temporal después de procesarlo con éxito
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      message: "Carga masiva completada con éxito",
      ...result
    });

  } catch (error) {
    // 🚩 6. MANEJO DE ERRORES: Borrar archivo si algo falla en el proceso
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("❌ UPLOAD LOCALES ERROR:", error.message);
    res.status(400).json({ 
      message: error.message || "Error al procesar el archivo Excel" 
    });
  }
};