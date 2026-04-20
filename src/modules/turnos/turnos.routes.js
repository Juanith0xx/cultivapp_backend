import { Router } from "express";
import pool from "../../database/db.js";
import protect from "../../middlewares/auth.js";

const router = Router();

/* ==========================================================================
   GET: Obtener todos los turnos de la empresa
   ========================================================================== */
router.get("/", protect, async (req, res) => {
  try {
    // 1. Intentamos obtener de req.user (inyectado por middleware)
    let company_id = req.user?.company_id;
    const userId = req.user?.id;

    // 🚩 MEJORA: Si company_id es null/undefined, lo buscamos directo en DB para evitar el 400
    if (!company_id && userId) {
      console.log(`⚠️ [TURNOS] company_id ausente en req.user para user ${userId}. Recuperando de DB...`);
      const userRes = await pool.query("SELECT company_id FROM public.users WHERE id = $1", [userId]);
      company_id = userRes.rows[0]?.company_id;
    }

    if (!company_id) {
      console.error("❌ [ERROR 400] No se pudo identificar la empresa para el usuario:", userId);
      return res.status(400).json({ 
        message: "No se identificó la empresa del usuario. Por favor, re-inicie sesión." 
      });
    }

    const result = await pool.query(
      `SELECT * FROM public.turnos_config 
       WHERE company_id = $1 
       ORDER BY nombre_turno ASC, day_of_week ASC`,
      [company_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ ERROR GET_TURNOS:", error.message);
    res.status(500).json({ message: "Error interno al obtener la configuración" });
  }
});

/* ==========================================================================
   POST: Carga Masiva de Bloques de Turno
   ========================================================================== */
router.post("/bulk", protect, async (req, res) => {
  const { nombre_turno, categoria_rol, days, entrada, salida } = req.body;
  let company_id = req.user?.company_id;
  const userId = req.user?.id;

  // Validación y recuperación de emergencia del company_id
  if (!company_id && userId) {
    const userRes = await pool.query("SELECT company_id FROM public.users WHERE id = $1", [userId]);
    company_id = userRes.rows[0]?.company_id;
  }

  if (!company_id) return res.status(401).json({ message: "Identificación de empresa fallida" });
  if (!nombre_turno || !days || !Array.isArray(days)) {
    return res.status(400).json({ message: "Datos incompletos o días no seleccionados" });
  }

  try {
    await pool.query("BEGIN");

    for (const day of days) {
      await pool.query(
        `INSERT INTO public.turnos_config 
          (company_id, nombre_turno, categoria_rol, day_of_week, entrada, salida)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (company_id, nombre_turno, day_of_week) 
         DO UPDATE SET 
            entrada = EXCLUDED.entrada, 
            salida = EXCLUDED.salida,
            categoria_rol = EXCLUDED.categoria_rol,
            updated_at = NOW()`,
        [
          company_id, 
          nombre_turno.trim().toUpperCase(), 
          categoria_rol || 'Mercaderista Full', 
          parseInt(day), 
          entrada, 
          salida
        ]
      );
    }

    await pool.query("COMMIT");
    res.status(201).json({ 
      success: true, 
      message: `Configuración guardada para el turno ${nombre_turno}` 
    });

  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("❌ [DB ERROR] POST_TURNOS_BULK:", error.message);
    res.status(500).json({ message: "Error al guardar en base de datos" });
  }
});

/* ==========================================================================
   DELETE: Eliminar un bloque específico
   ========================================================================== */
router.delete("/:id", protect, async (req, res) => {
  const { id } = req.params;
  const company_id = req.user?.company_id;

  try {
    const result = await pool.query(
      "DELETE FROM public.turnos_config WHERE id = $1 AND company_id = $2 RETURNING *",
      [id, company_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    res.json({ message: "Bloque eliminado" });
  } catch (error) {
    console.error("❌ ERROR DELETE_TURNO:", error.message);
    res.status(500).json({ message: "Error al eliminar" });
  }
});

export default router;