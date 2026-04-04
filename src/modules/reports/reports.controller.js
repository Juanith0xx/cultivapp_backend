import pool from "../../database/db.js";

/**
 * 📸 OBTIENE LA AUDITORÍA FOTOGRÁFICA
 */
export const getPhotoAudit = async (req, res) => {
  try {
    const { role, company_id: userCompanyId } = req.user;
    const { empresa_id, cadena, fecha, search } = req.query;

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
        c.name AS empresa_nombre
      FROM visit_photos vp
      JOIN user_routes r ON vp.visit_id = r.id
      JOIN users u ON r.user_id = u.id
      JOIN locales l ON r.local_id = l.id
      JOIN companies c ON u.company_id = c.id
      WHERE 1=1
    `;

    const queryParams = [];

    if (role !== 'ROOT') {
      queryParams.push(userCompanyId);
      query += ` AND u.company_id = $${queryParams.length}`;
    } else if (empresa_id) {
      queryParams.push(empresa_id);
      query += ` AND u.company_id = $${queryParams.length}`;
    }

    if (cadena) {
      queryParams.push(cadena);
      query += ` AND l.cadena = $${queryParams.length}`;
    }

    if (fecha) {
      queryParams.push(fecha);
      query += ` AND vp.created_at::date = $${queryParams.length}`;
    }

    if (search && search.trim() !== "") {
      queryParams.push(`%${search}%`);
      const pIdx = queryParams.length;
      query += ` AND (u.first_name ILIKE $${pIdx} OR u.last_name ILIKE $${pIdx} OR u.rut ILIKE $${pIdx})`;
    }

    query += ` ORDER BY vp.created_at DESC LIMIT 200`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);

  } catch (error) {
    console.error("❌ Error en getPhotoAudit:", error);
    res.status(500).json({ message: "Error al obtener auditoría", error: error.message });
  }
};

/**
 * 📝 ACTUALIZA UNA EVIDENCIA (Solo ROOT y ADMIN_CLIENT)
 * Esta es la función que te faltaba y causaba el SyntaxError
 */
export const updateVisitPhoto = async (req, res) => {
  const { id } = req.params;
  const { role, company_id: userCompanyId } = req.user;
  const { photo_type } = req.body;

  try {
    // 1. Verificar propiedad (Seguridad para ADMIN_CLIENT)
    const checkQuery = `
      SELECT u.company_id 
      FROM visit_photos vp
      JOIN user_routes r ON vp.visit_id = r.id
      JOIN users u ON r.user_id = u.id
      WHERE vp.id = $1
    `;
    const check = await pool.query(checkQuery, [id]);

    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Evidencia no encontrada" });
    }

    // 🚩 Si es ADMIN_CLIENT, no puede editar fotos de otras empresas
    if (role === 'ADMIN_CLIENT' && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ message: "No tienes permiso para editar este registro" });
    }

    // 2. Ejecutar actualización
    const updateQuery = `
      UPDATE visit_photos 
      SET evidence_type = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [photo_type, id]);

    res.json({
      message: "Evidencia actualizada con éxito",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Error en updateVisitPhoto:", error);
    res.status(500).json({ message: "Error interno al actualizar", error: error.message });
  }
};