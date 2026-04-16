import pool from "../../database/db.js";

/**
 * 📊 1. ESTADÍSTICAS PARA EL SEMÁFORO DE COBERTURA
 * Esta función es la que activará el "1" amarillo en tu panel.
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { role, company_id: userCompanyId } = req.user;
    const empresa_id = role === 'ROOT' ? req.query.company_id : userCompanyId;

    // Si no hay empresa definida (siendo ROOT), devolvemos todo en cero
    if (!empresa_id) {
      return res.json({ no_atendido: 0, atendiendo: 0, atendido: 0, sin_asignacion: 0 });
    }

    // --- LÓGICA DE TIEMPO CHILE ---
    // Obtenemos la fecha actual en formato YYYY-MM-DD para Chile
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    
    // Mapeo de día de la semana (Postgres 0=Dom, JS 0=Dom) 
    // Lo ajustamos a tu lógica de Planificación (1=Lun, 7=Dom)
    const dowMap = [7, 1, 2, 3, 4, 5, 6]; 
    const currentDay = dowMap[new Date().getDay()];

    const query = `
      WITH daily_routes AS (
        -- Rutas planificadas para hoy según el día de la semana
        SELECT id, local_id, user_id FROM public.user_routes 
        WHERE company_id = $1 AND day_of_week = $2
      ),
      daily_visits AS (
        -- Visitas reales registradas hoy (independiente de la ruta)
        SELECT route_id, check_in, check_out FROM public.visits 
        WHERE company_id = $1 AND check_in::date = $3
      )
      SELECT 
        -- 🔴 No Atendidos: Planificados que ni siquiera han iniciado
        COUNT(dr.id) FILTER (WHERE dv.check_in IS NULL) as no_atendido,
        
        -- 🟡 Atendiendo: Tienen Check-in pero NO Check-out (Botón "Continuar" activo)
        COUNT(dr.id) FILTER (WHERE dv.check_in IS NOT NULL AND dv.check_out IS NULL) as atendiendo,
        
        -- 🟢 Atendidos: Visitas finalizadas con Check-out
        COUNT(dr.id) FILTER (WHERE dv.check_out IS NOT NULL) as atendido,

        -- ⚫ Sin Mercaderista: Locales activos de la empresa sin ruta hoy
        (SELECT COUNT(*) FROM public.locales l 
         WHERE l.company_id = $1 AND l.is_active = true
         AND NOT EXISTS (SELECT 1 FROM daily_routes dr2 WHERE dr2.local_id = l.id)
        ) as sin_asignacion
      FROM daily_routes dr
      LEFT JOIN daily_visits dv ON dr.id = dv.route_id;
    `;

    const result = await pool.query(query, [empresa_id, currentDay, today]);
    
    // Enviamos los datos reales al Semáforo
    res.json(result.rows[0]);

  } catch (error) {
    console.error("❌ Error Crítico en getDashboardStats:", error.message);
    res.status(500).json({ message: "Error al calcular semáforo", error: error.message });
  }
};

/**
 * 📸 2. AUDITORÍA FOTOGRÁFICA (Mejorado)
 * Ahora con joins precisos y corrección de zona horaria al mostrar la fecha
 */
export const getPhotoAudit = async (req, res) => {
  try {
    const { role, company_id: userCompanyId } = req.user;
    let { empresa_id, cadena, fecha, search } = req.query;

    const isInvalid = (val) => !val || val === "[object Object]" || val === "undefined" || val === "null";

    // Blindaje de seguridad
    if (role !== 'ROOT') {
      empresa_id = userCompanyId;
    } else if (isInvalid(empresa_id)) {
      return res.json([]);
    }

    let query = `
      SELECT 
        vp.id,
        vp.image_url AS photo_url,
        vp.evidence_type AS photo_type,
        -- Convertimos la hora de la foto a hora de Chile para el Frontend
        vp.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago' as created_at,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.rut AS user_rut,
        l.cadena,
        l.direccion AS local_nombre, 
        l.codigo_local AS local_codigo,
        c.name AS empresa_nombre
      FROM public.visit_photos vp
      INNER JOIN public.visits v ON vp.visit_id = v.id
      INNER JOIN public.user_routes r ON v.route_id = r.id
      INNER JOIN public.users u ON v.user_id = u.id
      INNER JOIN public.locales l ON r.local_id = l.id
      INNER JOIN public.companies c ON vp.company_id = c.id
      WHERE vp.company_id = $1
    `;

    const queryParams = [empresa_id];
    const cleanSearch = !isInvalid(search) ? search.trim() : "";

    // Lógica de búsqueda prioritaria
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
      // Si no hay búsqueda, filtramos por la fecha de hoy en Santiago
      const todayChile = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
      const dateToFilter = !isInvalid(fecha) ? fecha : todayChile;
      queryParams.push(dateToFilter);
      query += ` AND vp.created_at::date = $${queryParams.length}`;
    }

    if (!isInvalid(cadena)) {
      queryParams.push(cadena);
      query += ` AND l.cadena = $${queryParams.length}`;
    }

    query += ` ORDER BY vp.created_at DESC LIMIT 150`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows || []);

  } catch (error) {
    console.error("❌ Error Crítico en getPhotoAudit:", error.message);
    res.status(500).json({ message: "Error interno en auditoría" });
  }
};

/**
 * 📝 3. ACTUALIZAR TIPO DE EVIDENCIA
 */
export const updateVisitPhoto = async (req, res) => {
  const { id } = req.params;
  const { role, company_id: userCompanyId } = req.user;
  const { photo_type } = req.body;

  try {
    const check = await pool.query(`SELECT company_id FROM public.visit_photos WHERE id = $1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ message: "Foto no encontrada" });

    // Verificación de permisos
    if (role !== 'ROOT' && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ message: "Acceso denegado a esta foto" });
    }

    const result = await pool.query(`
      UPDATE public.visit_photos 
      SET evidence_type = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `, [photo_type, id]);

    res.json({ message: "Actualizado", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Error", error: error.message });
  }
};