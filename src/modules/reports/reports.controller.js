import pool from "../../database/db.js";

/**
 * 📸 OBTIENE LA AUDITORÍA FOTOGRÁFICA
 * Mejora: Joins robustos y prioridad de filtrado por empresa
 */
export const getPhotoAudit = async (req, res) => {
  try {
    const { role, company_id: userCompanyId } = req.user;
    let { empresa_id, cadena, fecha, search } = req.query;

    // --- 🛡️ BLINDAJE DE PARÁMETROS ---
    const isInvalid = (val) => !val || val === "[object Object]" || val === "undefined" || val === "null";

    // Si no es ROOT, la empresa SIEMPRE es la del usuario logueado
    if (role !== 'ROOT') {
      empresa_id = userCompanyId;
    } else if (isInvalid(empresa_id)) {
      // Si es ROOT y no eligió nada, retornamos vacío para evitar ver fotos de todos mezcladas
      return res.json([]);
    }

    let query = `
      SELECT 
        vp.id,
        vp.image_url AS photo_url,
        vp.evidence_type AS photo_type,
        vp.created_at,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.rut AS user_rut,
        l.cadena,
        l.direccion AS local_nombre, 
        l.codigo_local AS local_codigo,
        c.name AS empresa_nombre
      FROM public.visit_photos vp
      LEFT JOIN public.user_routes r ON vp.visit_id = r.id
      LEFT JOIN public.users u ON r.user_id = u.id
      LEFT JOIN public.locales l ON r.local_id = l.id
      LEFT JOIN public.companies c ON vp.company_id = c.id
      WHERE vp.company_id = $1
    `;

    const queryParams = [empresa_id];

    /**
     * 🚩 LÓGICA DE BÚSQUEDA GLOBAL
     * Si el usuario escribe algo, ignoramos la fecha para buscar en todo el historial.
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
      // Si no hay búsqueda de texto, aplicamos el filtro de fecha (Hoy o la seleccionada)
      const dateToFilter = !isInvalid(fecha) ? fecha : new Date().toISOString().split('T')[0];
      queryParams.push(dateToFilter);
      query += ` AND vp.created_at::date = $${queryParams.length}`;
    }

    // Filtro por cadena (opcional)
    if (!isInvalid(cadena)) {
      queryParams.push(cadena);
      query += ` AND l.cadena = $${queryParams.length}`;
    }

    query += ` ORDER BY vp.created_at DESC LIMIT 200`;

    const result = await pool.query(query, queryParams);
    
    // Si no hay resultados, enviamos array vacío en vez de error
    res.json(result.rows || []);

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

    if (check.rows.length === 0) return res.status(404).json({ message: "No encontrada" });

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
    res.json({ message: "Actualizado con éxito", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Error", error: error.message });
  }
};