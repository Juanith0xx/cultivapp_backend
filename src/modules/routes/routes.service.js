import db from "../../database/db.js";

/* =========================================================
   OBTENER RUTAS POR USUARIO Y FECHA (NUEVA: Para el Timeline)
   Soporta rutas únicas por fecha y rutas recurrentes por día de la semana
========================================================= */
export const getRoutesByUserAndDate = async (company_id, user_id, date) => {
  try {
    const query = `
      SELECT 
        ur.id, 
        ur.visit_date, 
        ur.start_time, 
        ur.status, 
        ur.order_sequence, 
        ur.day_of_week,
        ur.is_recurring,
        l.cadena, 
        l.direccion, 
        l.lat as local_lat, 
        l.lng as local_lng,
        u.first_name,
        u.last_name
      FROM public.user_routes ur
      JOIN public.locales l ON ur.local_id = l.id
      JOIN public.users u ON ur.user_id = u.id
      WHERE ur.company_id = $1 
        AND ur.user_id = $2
        AND (
          -- Caso 1: Ruta agendada para una fecha específica
          CAST(ur.visit_date AS DATE) = CAST($3 AS DATE)
          OR 
          -- Caso 2: Ruta recurrente que coincide con el día de la semana de esa fecha
          (ur.is_recurring = true AND ur.day_of_week = EXTRACT(DOW FROM CAST($3 AS DATE)))
        )
      ORDER BY ur.start_time ASC, ur.order_sequence ASC
    `;
    
    const { rows } = await db.query(query, [company_id, user_id, date]);
    return rows;
  } catch (error) {
    console.error("❌ Error en getRoutesByUserAndDate Service:", error.message);
    throw error;
  }
};

/* =========================================================
   CREAR RUTAS (SOPORTE MANUAL / MASIVO / RECURRENTE)
========================================================= */
export const bulkCreateRoutes = async (tasks) => {
  const results = [];

  for (const task of tasks) {
    const { 
      company_id, user_id, local_id, 
      visit_date, start_time, order_sequence, warehouse_id,
      day_of_week, schedule_group_id, is_recurring 
    } = task;

    try {
      const query = `
        INSERT INTO public.user_routes (
          company_id, user_id, local_id, visit_date, start_time, 
          order_sequence, warehouse_id, status, 
          day_of_week, schedule_group_id, is_recurring,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, $10, NOW(), NOW()) 
        RETURNING *;
      `;

      const result = await db.query(query, [
        company_id, user_id, local_id, visit_date || null, start_time, 
        order_sequence || 0, warehouse_id || null,
        day_of_week, schedule_group_id, is_recurring || false
      ]);

      if (result.rows.length > 0) {
        results.push(result.rows[0]);
      }
    } catch (error) {
      console.error("❌ Error insertando ruta individual:", error.message);
    }
  }
  return results;
};

/* =========================================================
   ACTUALIZAR RUTA (EDICIÓN COMPLETA DE GRUPO)
========================================================= */
export const updateRoute = async (id, data) => {
  const { user_id, local_id, start_time, selectedDays, visit_date, company_id } = data;

  const routeInfo = await db.query(
    `SELECT schedule_group_id, is_recurring FROM public.user_routes WHERE id = $1`, 
    [id]
  );
  
  const groupId = routeInfo.rows[0]?.schedule_group_id;

  if (groupId && routeInfo.rows[0]?.is_recurring) {
    await db.query(
      `DELETE FROM public.user_routes WHERE schedule_group_id = $1 AND company_id = $2`,
      [groupId, company_id]
    );

    const tasks = (selectedDays || []).map(day => ({
      company_id,
      user_id,
      local_id,
      visit_date: null,
      start_time,
      day_of_week: day,
      schedule_group_id: groupId,
      is_recurring: true,
      status: 'PENDING'
    }));

    const updatedRows = await bulkCreateRoutes(tasks);
    return updatedRows[0];
  } else {
    const result = await db.query(
      `UPDATE public.user_routes 
       SET user_id = $1, local_id = $2, start_time = $3, visit_date = $4, updated_at = NOW()
       WHERE id = $5 AND company_id = $6
       RETURNING *`,
      [user_id, local_id, start_time, visit_date || null, id, company_id]
    );
    return result.rows[0];
  }
};

/* =========================================================
   OBTENER DETALLE PARA GPS
========================================================= */
export const getRouteDetail = async (id, company_id) => {
  const result = await db.query(
    `SELECT ur.*, l.lat as local_lat, l.lng as local_lng 
     FROM public.user_routes ur
     JOIN public.locales l ON ur.local_id = l.id
     WHERE ur.id = $1 AND ur.company_id = $2`,
    [id, company_id]
  );
  return result.rows[0];
};

/* =========================================================
   REGISTRAR CHECK-IN CON GPS
========================================================= */
export const registerCheckInWithGps = async (data) => {
  const { id, company_id, lat_in, lng_in, distance_meters, is_valid_gps } = data;
  
  const result = await db.query(
    `UPDATE public.user_routes 
     SET 
       check_in = NOW(), 
       status = 'IN_PROGRESS',
       lat_in = $1,
       lng_in = $2,
       distance_meters = $3,
       is_valid_gps = $4,
       updated_at = NOW()
     WHERE id = $5 AND company_id = $6 AND status = 'PENDING'
     RETURNING *`,
    [lat_in, lng_in, distance_meters, is_valid_gps, id, company_id]
  );

  if (result.rows.length === 0) {
    throw new Error("No se pudo iniciar la visita.");
  }
  return result.rows[0];
};

/* =========================================================
   OBTENER RUTAS POR USUARIO
========================================================= */
export const getRoutesByUser = async (company_id, user_id) => {
  const result = await db.query(
    `SELECT ur.id, ur.visit_date, ur.start_time, ur.status, ur.order_sequence, ur.day_of_week,
            ur.check_in, ur.lat_in, ur.lng_in, ur.is_valid_gps,
            l.cadena, l.direccion, l.lat, l.lng,
            c.name as comuna_name
     FROM public.user_routes ur
     JOIN public.locales l ON ur.local_id = l.id
     LEFT JOIN public.comunas c ON l.comuna_id = c.id
     WHERE ur.company_id = $1 AND ur.user_id = $2
     ORDER BY ur.visit_date ASC, ur.day_of_week ASC, ur.order_sequence ASC`,
    [company_id, user_id]
  );
  return result.rows;
};

/* =========================================================
   OBTENER RUTAS POR EMPRESA
========================================================= */
export const getRoutesByCompany = async (company_id) => {
  const query = `
    SELECT 
      ur.schedule_group_id, ur.user_id, ur.local_id, ur.company_id, ur.status, ur.start_time, ur.visit_date, ur.is_recurring,
      u.first_name, u.last_name, u.rut as user_rut,
      l.cadena, l.direccion,
      c.name as comuna_name,
      CASE 
        WHEN ur.is_recurring = true THEN array_agg(DISTINCT ur.day_of_week ORDER BY ur.day_of_week)
        ELSE ARRAY[NULL::integer]
      END as days_array,
      MIN(ur.id::text)::uuid as id 
    FROM public.user_routes ur
    JOIN public.users u ON ur.user_id = u.id
    JOIN public.locales l ON ur.local_id = l.id
    LEFT JOIN public.comunas c ON l.comuna_id = c.id
    WHERE ur.company_id = $1 AND ur.deleted_at IS NULL
    GROUP BY 
      ur.schedule_group_id, ur.user_id, ur.local_id, ur.company_id, 
      ur.status, ur.start_time, ur.visit_date, ur.is_recurring,
      u.first_name, u.last_name, u.rut, l.cadena, l.direccion, c.name
    ORDER BY ur.visit_date DESC, ur.start_time ASC;
  `;
  
  const result = await db.query(query, [company_id]);
  return result.rows;
};

/* =========================================================
   ELIMINAR RUTA
========================================================= */
export const deleteRoute = async (company_id, route_id) => {
  const routeInfo = await db.query(
    `SELECT schedule_group_id FROM public.user_routes WHERE id = $1 AND company_id = $2`,
    [route_id, company_id]
  );

  const groupId = routeInfo.rows[0]?.schedule_group_id;

  if (groupId) {
    await db.query(
      `DELETE FROM public.user_routes WHERE schedule_group_id = $1 AND company_id = $2`,
      [groupId, company_id]
    );
  } else {
    const result = await db.query(
      `DELETE FROM public.user_routes WHERE id = $1 AND company_id = $2 RETURNING id`,
      [route_id, company_id]
    );
    if (result.rows.length === 0) throw new Error("Ruta no encontrada");
  }

  return { message: "Planificación eliminada correctamente" };
};