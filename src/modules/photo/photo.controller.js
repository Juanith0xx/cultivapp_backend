import pool from "../../config/db.js";

export const getPhotoAudit = async (req, res) => {
  try {
    const { role, company_id: userCompanyId } = req.user; // Datos del JWT
    const { empresa_id, cadena, fecha, search, local_codigo } = req.query;

    let query = `
      SELECT 
        v.id,
        v.photo_url,
        v.photo_type,
        v.created_at,
        u.full_name as user_name,
        u.rut as user_rut,
        l.nombre as local_nombre,
        l.cadena,
        l.codigo as local_codigo,
        c.name as empresa_nombre
      FROM visit_photos v
      JOIN users u ON v.user_id = u.id
      JOIN locales l ON v.local_id = l.id
      JOIN companies c ON u.company_id = c.id
      WHERE 1=1
    `;

    const queryParams = [];

    // 🚩 SEGURIDAD: Si es ADMIN, solo ve su empresa. Si es ROOT, puede filtrar.
    if (role === 'ADMIN') {
      queryParams.push(userCompanyId);
      query += ` AND u.company_id = $${queryParams.length}`;
    } else if (role === 'ROOT' && empresa_id) {
      queryParams.push(empresa_id);
      query += ` AND u.company_id = $${queryParams.length}`;
    }

    // Filtro por Cadena
    if (cadena) {
      queryParams.push(cadena);
      query += ` AND l.cadena = $${queryParams.length}`;
    }

    // Filtro por Fecha (Solo el día)
    if (fecha) {
      queryParams.push(fecha);
      query += ` AND DATE(v.created_at) = $${queryParams.length}`;
    }

    // Filtro por Local (Código)
    if (local_codigo) {
      queryParams.push(local_codigo);
      query += ` AND l.codigo = $${queryParams.length}`;
    }

    // Buscador (Nombre o RUT)
    if (search) {
      queryParams.push(`%${search}%`);
      query += ` AND (u.full_name ILIKE $${queryParams.length} OR u.rut ILIKE $${queryParams.length})`;
    }

    query += ` ORDER BY v.created_at DESC LIMIT 100`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);

  } catch (error) {
    console.error("Error en Photo Audit:", error);
    res.status(500).json({ message: "Error al obtener la auditoría de fotos" });
  }
};