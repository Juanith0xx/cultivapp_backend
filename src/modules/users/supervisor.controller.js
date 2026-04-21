import db from "../../database/db.js";

export const getSupervisorLocales = async (req, res) => {
  try {
    const { id } = req.params; 
    const query = `
      SELECT l.id, l.cadena, l.direccion, l.codigo_local, c.name as comuna_name
      FROM public.locales l
      JOIN public.supervisor_locales sl ON l.id = sl.locale_id
      LEFT JOIN public.comunas c ON l.comuna_id = c.id
      WHERE sl.supervisor_id = $1 AND l.deleted_at IS NULL
      ORDER BY l.cadena ASC
    `;
    const result = await db.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener cobertura" });
  }
};

export const assignLocales = async (req, res) => {
  const { id } = req.params;
  const { localeIds } = req.body; 
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM public.supervisor_locales WHERE supervisor_id = $1", [id]);

    if (localeIds && localeIds.length > 0) {
      // Usamos unnest para insertar múltiples filas de una vez de forma limpia
      const insertQuery = `
        INSERT INTO public.supervisor_locales (supervisor_id, locale_id)
        SELECT $1, unnest($2::uuid[])
      `;
      await client.query(insertQuery, [id, localeIds]);
    }

    await client.query("COMMIT");
    res.json({ message: "Cobertura actualizada correctamente" });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: "Error en la asignación" });
  } finally {
    client.release();
  }
};