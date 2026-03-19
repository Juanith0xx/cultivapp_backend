import db from "../../database/db.js";

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
        ON CONFLICT (user_id, local_id, visit_date, day_of_week) DO NOTHING
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
   Si la ruta tiene un schedule_group_id, actualiza a todos los miembros
========================================================= */
export const updateRoute = async (id, data) => {
  const { user_id, local_id, start_time, selectedDays, visit_date, company_id } = data;

  // 1. Buscamos si la ruta pertenece a un grupo
  const routeInfo = await db.query(
    `SELECT schedule_group_id, is_recurring FROM public.user_routes WHERE id = $1`, 
    [id]
  );
  
  const groupId = routeInfo.rows[0]?.schedule_group_id;

  if (groupId && routeInfo.rows[0]?.is_recurring) {
    // 2. Si es recurrente, borramos los días actuales del grupo e insertamos los nuevos
    // para que la edición de días (agregar/quitar) sea exacta.
    await db.query(
      `DELETE FROM public.user_routes WHERE schedule_group_id = $1 AND company_id = $2`,
      [groupId, company_id]
    );

    // 3. Re-insertamos los nuevos días seleccionados manteniendo el mismo groupId
    const tasks = selectedDays.map(day => ({
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
    // 4. Si es una ruta única sin grupo, actualización estándar
    const result = await db.query(
      `UPDATE public.user_routes 
       SET 
         user_id = $1, 
         local_id = $2, 
         start_time = $3, 
         visit_date = $4,
         updated_at = NOW()
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
    throw new Error("No se pudo iniciar la visita. Verifique el estado actual.");
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
   OBTENER RUTAS POR EMPRESA (CON AGRUPACIÓN CORREGIDA)
========================================================= */
export const getRoutesByCompany = async (company_id) => {
  const query = `
    SELECT 
      ur.schedule_group_id,
      ur.user_id,
      ur.local_id,
      ur.company_id,
      ur.status,
      ur.start_time,
      ur.visit_date,
      ur.is_recurring,
      u.first_name, 
      u.last_name, 
      u.rut as user_rut,
      l.cadena, 
      l.direccion,
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
   ELIMINAR RUTA (ELIMINACIÓN DE GRUPO)
   Si es parte de una serie recurrente, elimina toda la serie
========================================================= */
export const deleteRoute = async (company_id, route_id) => {
  // 1. Primero buscamos si la ruta tiene un schedule_group_id
  const routeInfo = await db.query(
    `SELECT schedule_group_id FROM public.user_routes WHERE id = $1 AND company_id = $2`,
    [route_id, company_id]
  );

  const groupId = routeInfo.rows[0]?.schedule_group_id;

  if (groupId) {
    // 2. Si tiene grupo, borramos todos los días de ese grupo
    await db.query(
      `DELETE FROM public.user_routes WHERE schedule_group_id = $1 AND company_id = $2`,
      [groupId, company_id]
    );
  } else {
    // 3. Si no tiene grupo, borramos solo la ruta individual
    const result = await db.query(
      `DELETE FROM public.user_routes WHERE id = $1 AND company_id = $2 RETURNING id`,
      [route_id, company_id]
    );
    if (result.rows.length === 0) throw new Error("Ruta no encontrada");
  }

  return { message: "Planificación eliminada correctamente" };
};