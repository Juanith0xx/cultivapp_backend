import pool from "../../database/db.js";

/**
 * 📊 1. ESTADÍSTICAS PARA EL SEMÁFORO DE COBERTURA
 * Blindaje: Se agrega casting explícito a UUID y manejo de nulos para evitar Error 500.
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { role, company_id: userCompanyId, id: currentUserId } = req.user;
    const { company_id: queryCompanyId, supervisor_id } = req.query;

    // Sanitización de IDs para evitar errores de tipo en Postgres
    const target_supervisor = role === 'SUPERVISOR' ? currentUserId : (supervisor_id || null);
    const empresa_id = role === 'ROOT' ? queryCompanyId : userCompanyId;

    if (!empresa_id || !target_supervisor) {
      return res.json({ no_atendido: 0, atendiendo: 0, atendido: 0, sin_asignacion: 0 });
    }

    const todayChile = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    const dowMap = [7, 1, 2, 3, 4, 5, 6]; 
    const currentDay = dowMap[new Date().getDay()];

    const query = `
      WITH my_portfolio AS (
        -- Filtramos los locales usando casting explícito a UUID
        SELECT locale_id FROM public.supervisor_locales 
        WHERE supervisor_id = $4::uuid
      ),
      planned_today AS (
        -- Planificación filtrada por cartera y empresa
        SELECT 
          ur.id as route_id, 
          ur.local_id,
          ur.check_in,
          ur.check_out
        FROM public.user_routes ur
        WHERE ur.company_id = $1::uuid
        AND ur.local_id IN (SELECT locale_id FROM my_portfolio)
        AND (ur.visit_date = $3::date OR (ur.visit_date IS NULL AND ur.day_of_week = $2))
        AND ur.deleted_at IS NULL
      ),
      actual_visits AS (
        -- Visitas del día cruzadas con la planificación
        SELECT 
          v.route_id, 
          v.started_at, 
          v.finished_at 
        FROM public.visits v
        WHERE v.route_id IN (SELECT route_id FROM planned_today)
        AND (v.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago')::date = $3::date
      )
      SELECT 
        -- 🔴 No Atendido
        COUNT(pt.route_id) FILTER (
          WHERE pt.check_in IS NULL AND av.started_at IS NULL
        )::int as no_atendido,

        -- 🟡 Atendiendo
        COUNT(pt.route_id) FILTER (
          WHERE (pt.check_in IS NOT NULL AND pt.check_out IS NULL)
          OR (av.started_at IS NOT NULL AND av.finished_at IS NULL)
        )::int as atendiendo,

        -- 🟢 Atendido
        COUNT(pt.route_id) FILTER (
          WHERE pt.check_out IS NOT NULL OR av.finished_at IS NOT NULL
        )::int as atendido,

        -- ⚫ Sin Mercaderista
        (SELECT COUNT(*)::int FROM my_portfolio 
         WHERE locale_id NOT IN (SELECT local_id FROM planned_today)) as sin_asignacion
      FROM planned_today pt
      LEFT JOIN actual_visits av ON pt.route_id = av.route_id;
    `;

    // Parámetros ordenados: $1:empresa, $2:día_int, $3:fecha, $4:supervisor
    const queryParams = [empresa_id, currentDay, todayChile, target_supervisor];

    const result = await pool.query(query, queryParams);
    
    res.json(result.rows[0] || { no_atendido: 0, atendiendo: 0, atendido: 0, sin_asignacion: 0 });

  } catch (error) {
    console.error("❌ Error Crítico Semáforo:", error.message);
    res.status(500).json({ message: "Error al calcular semáforo", details: error.message });
  }
};

/**
 * 📸 2. AUDITORÍA FOTOGRÁFICA
 */
export const getPhotoAudit = async (req, res) => {
  try {
    const { role, company_id: userCompanyId } = req.user;
    let { empresa_id, cadena, fecha, search } = req.query;

    const isInvalid = (val) => !val || val === "[object Object]" || val === "undefined" || val === "null";

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
    console.error("❌ Error en getPhotoAudit:", error.message);
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

    if (role !== 'ROOT' && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ message: "Acceso denegado" });
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