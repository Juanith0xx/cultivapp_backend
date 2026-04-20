import pool from "../../database/db.js";

export const bulkCreateTurnos = async (req, res) => {
  const { nombre_turno, categoria_rol, days, entrada, salida } = req.body;
  const { company_id } = req.user; // Obtenido del middleware protect

  if (!days || !Array.isArray(days)) {
    return res.status(400).json({ message: "Días inválidos" });
  }

  try {
    // Usamos una transacción para asegurar que se guarden todos o ninguno
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
            updated_at = NOW()`,
        [company_id, nombre_turno, categoria_rol, day, entrada, salida]
      );
    }

    await pool.query("COMMIT");
    res.status(201).json({ message: "Bloques de turno creados/actualizados" });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("❌ ERROR TURNOS_BULK:", error);
    res.status(500).json({ message: "Error interno al crear los turnos" });
  }
};