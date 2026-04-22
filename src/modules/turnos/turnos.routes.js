import { Router } from "express";
import pool from "../../database/db.js";
import protect from "../../middlewares/auth.js";

const router = Router();

/* ==========================================================================
   GET: Obtener todos los turnos (SaaS Isolation: Root ve todo)
   ========================================================================== */
router.get("/", protect, async (req, res) => {
  try {
    let company_id = req.user?.company_id;
    const role = req.user?.role;
    const userId = req.user?.id;

    // Recuperación de emergencia si falta el company_id en el token
    if (!company_id && userId && role !== 'ROOT') {
      console.log(`⚠️ [TURNOS] company_id ausente en req.user para user ${userId}. Recuperando de DB...`);
      const userRes = await pool.query("SELECT company_id FROM public.users WHERE id = $1", [userId]);
      company_id = userRes.rows[0]?.company_id;
    }

    let result;

    // 🚩 MEJORA: Lógica de ROOT vs Usuarios Normales
    if (role === 'ROOT') {
      // El ROOT ve absolutamente todo, incluyendo el nombre de la empresa para no confundirse
      result = await pool.query(
        `SELECT t.*, c.name as company_name 
         FROM public.turnos_config t
         LEFT JOIN public.companies c ON t.company_id = c.id
         ORDER BY t.company_id, t.nombre_turno ASC, t.day_of_week ASC`
      );
    } else {
      // Aislamiento por empresa para Admin/Supervisores
      if (!company_id) {
        return res.status(400).json({ message: "No se identificó la empresa del usuario." });
      }

      result = await pool.query(
        `SELECT * FROM public.turnos_config 
         WHERE company_id = $1 
         ORDER BY nombre_turno ASC, day_of_week ASC`,
        [company_id]
      );
    }

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
  const { nombre_turno, categoria_rol, days, entrada, salida, company_id: companyIdFromBody } = req.body;
  const role = req.user?.role;
  let company_id = req.user?.company_id;
  const userId = req.user?.id;

  // Si es ROOT, puede enviar el company_id en el body para asignar turnos a empresas específicas
  if (role === 'ROOT') {
    company_id = companyIdFromBody;
  } else if (!company_id && userId) {
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
   PUT: Actualización Masiva (Edición)
   ========================================================================== */
router.put("/bulk/:nombre_turno", protect, async (req, res) => {
  const { nombre_turno } = req.params;
  const { categoria_rol, days, entrada, salida, company_id: companyIdFromBody } = req.body;
  const role = req.user?.role;
  let company_id = req.user?.company_id;
  const userId = req.user?.id;

  if (role === 'ROOT') {
    company_id = companyIdFromBody;
  } else if (!company_id && userId) {
    const userRes = await pool.query("SELECT company_id FROM public.users WHERE id = $1", [userId]);
    company_id = userRes.rows[0]?.company_id;
  }

  if (!company_id) return res.status(401).json({ message: "Identificación de empresa fallida" });

  try {
    await pool.query("BEGIN");

    // Eliminamos la configuración anterior para asegurar limpieza de días deseleccionados
    await pool.query(
      "DELETE FROM public.turnos_config WHERE UPPER(nombre_turno) = UPPER($1) AND company_id = $2",
      [nombre_turno, company_id]
    );

    for (const day of days) {
      await pool.query(
        `INSERT INTO public.turnos_config 
          (company_id, nombre_turno, categoria_rol, day_of_week, entrada, salida)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          company_id,
          nombre_turno.trim().toUpperCase(),
          categoria_rol,
          parseInt(day),
          entrada,
          salida
        ]
      );
    }

    await pool.query("COMMIT");
    res.json({ success: true, message: "Turno actualizado correctamente" });

  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("❌ [DB ERROR] PUT_TURNOS_BULK:", error.message);
    res.status(500).json({ message: "Error al actualizar la configuración" });
  }
});

/* ==========================================================================
   DELETE: Eliminar un bloque específico
   ========================================================================== */
router.delete("/:id", protect, async (req, res) => {
  const { id } = req.params;
  const { company_id, role } = req.user;

  try {
    let result;
    
    if (role === 'ROOT') {
      // El ROOT puede borrar cualquier turno sin importar el company_id
      result = await pool.query(
        "DELETE FROM public.turnos_config WHERE id = $1 RETURNING *",
        [id]
      );
    } else {
      // Usuario normal restringido a su propia empresa
      result = await pool.query(
        "DELETE FROM public.turnos_config WHERE id = $1 AND company_id = $2 RETURNING *",
        [id, company_id]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Registro no encontrado o sin permisos" });
    }

    res.json({ message: "Bloque eliminado" });
  } catch (error) {
    console.error("❌ ERROR DELETE_TURNO:", error.message);
    res.status(500).json({ message: "Error al eliminar" });
  }
});

export default router;