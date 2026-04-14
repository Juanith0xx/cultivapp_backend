import pool from "../../database/db.js";

/**
 * 📸 OBTIENE LA AUDITORÍA FOTOGRÁFICA
 * Optimización: Uso de company_id directo en visit_photos y blindaje de parámetros.
 */
export const getPhotoAudit = async (req, res) => {
  try {
    const { role, company_id: userCompanyId } = req.user;
    let { empresa_id, cadena, fecha, search } = req.query;

    // --- 🛡️ BLINDAJE DE PARÁMETROS (Anti "[object Object]") ---
    const isInvalid = (val) => !val || val === "[object Object]" || val === "undefined" || val === "null";

    if (isInvalid(empresa_id)) {
      empresa_id = (role !== 'ROOT') ? userCompanyId : null;
    }

    // Si es ROOT y no hay ID de empresa, retornamos vacío para no romper el SQL
    if (role === 'ROOT' && !empresa_id) return res.json([]);

    let query = `
      SELECT 
        vp.id,
        vp.image_url AS photo_url, -- ✅ Mapeado para el Frontend
        vp.evidence_type AS photo_type,
        vp.created_at,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.rut AS user_rut,
        l.cadena,
        l.direccion AS local_nombre, 
        l.codigo_local AS local_codigo,
        c.name AS empresa_nombre
      FROM public.visit_photos vp
      JOIN public.user_routes r ON vp.visit_id = r.id
      JOIN public.users u ON r.user_id = u.id
      JOIN public.locales l ON r.local_id = l.id
      JOIN public.companies c ON vp.company_id = c.id -- ✅ JOIN directo por company_id de la foto
      WHERE vp.company_id = $1 -- ✅ Filtro directo (más eficiente)
    `;

    const queryParams = [empresa_id];

    /**
     * 🚩 LÓGICA DE BÚSQUEDA GLOBAL
     * Priorizamos el buscador por sobre la fecha.
     */
    const cleanSearch = !isInvalid(search) ? search.trim() : "";

    if (cleanSearch !== "") {
      queryParams.push(`%${cleanSearch}%`);
      const pIdx = queryParams.length;
      query += ` AND (
        u.first_name ILIKE $${pIdx} OR 
        u.last_name ILIKE $${pIdx} OR 
        u.rut ILIKE $${pIdx} OR
        l.direccion ILIKE $${pIdx} OR
        l.codigo_local ILIKE $${pIdx}
      )`;
    } else {
      // Si no hay búsqueda de texto, filtramos por la fecha
      const dateToFilter = !isInvalid(fecha) ? fecha : new Date().toISOString().split('T')[0];
      queryParams.push(dateToFilter);
      query += ` AND vp.created_at::date = $${queryParams.length}`;
    }

    // Filtro opcional por cadena
    if (!isInvalid(cadena)) {
      queryParams.push(cadena);
      query += ` AND l.cadena = $${queryParams.length}`;
    }

    query += ` ORDER BY vp.created_at DESC LIMIT 200`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);

  } catch (error) {
    console.error("❌ Error Crítico en getPhotoAudit:", error.message);
    res.status(500).json({ 
      message: "Error interno al procesar auditoría", 
      details: error.message 
    });
  }
};

/**
 * 📝 ACTUALIZA UNA EVIDENCIA
 */
export const updateVisitPhoto = async (req, res) => {
  const { id } = req.params;
  const { role, company_id: userCompanyId } = req.user;
  const { photo_type } = req.body;

  try {
    const checkQuery = `SELECT company_id FROM public.visit_photos WHERE id = $1`;
    const check = await pool.query(checkQuery, [id]);

    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Evidencia no encontrada" });
    }

    if (role === 'ADMIN_CLIENT' && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ message: "Sin permisos sobre este registro" });
    }

    const updateQuery = `
      UPDATE public.visit_photos 
      SET evidence_type = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [photo_type, id]);

    res.json({
      message: "Actualizado con éxito",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Error en updateVisitPhoto:", error);
    res.status(500).json({ message: "Error interno", error: error.message });
  }
};