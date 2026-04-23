import db from "../../database/db.js";

/* =========================================================
   OBTENER RUTAS POR EMPRESA (VISTA ADMINISTRADOR)
   🚩 MEJORA: Uso de columna 'origin' para etiquetas precisas
========================================================= */
export const getRoutesByCompany = async (company_id) => {
  try {
    const query = `
      SELECT 
        ur.*, 
        u.first_name, u.last_name, 
        u.tipo_contrato as user_role,
        l.id as local_id, l.cadena, l.direccion, l.codigo_local,
        c.name as comuna_name,
        -- 🕵️ Solo buscamos nombre si el origen es TURNO. 
        -- Si es INDIVIDUAL, devolvemos NULL para que el frontend muestre "Manual"
        CASE 
          WHEN ur.origin = 'TURNO' THEN (
            SELECT nombre_turno 
            FROM public.turnos_config tc 
            WHERE tc.company_id = ur.company_id 
              AND tc.entrada = ur.start_time 
              AND tc.day_of_week = ur.day_of_week
            LIMIT 1
          )
          ELSE NULL 
        END as nombre_turno
      FROM public.user_routes ur
      JOIN public.users u ON ur.user_id = u.id
      JOIN public.locales l ON ur.local_id = l.id
      LEFT JOIN public.comunas c ON l.comuna_id = c.id
      WHERE ($1::uuid IS NULL OR ur.company_id = $1)
        AND ur.deleted_at IS NULL
      ORDER BY ur.visit_date ASC;
    `;
    const result = await db.query(query, [company_id]);
    return result.rows;
  } catch (error) {
    console.error("❌ Error en getRoutesByCompany Service:", error.message);
    throw error;
  }
};

/* =========================================================
   CREAR RUTAS (BULK)
   🚩 MEJORA: Persistencia del campo 'origin'
========================================================= */
export const bulkCreateRoutes = async (tasks) => {
  const client = await db.connect();
  const results = [];
  
  try {
    await client.query('BEGIN');
    
    for (const task of tasks) {
      const { 
        company_id, user_id, local_id, visit_date, start_time, 
        order_sequence, warehouse_id, is_recurring, selectedDays, 
        schedule_group_id, day_of_week, origin // 🚩 Recibimos origin desde el controller
      } = task;

      const calculatedDay = visit_date ? new Date(visit_date + "T12:00:00").getDay() : day_of_week;

      const daysToInsert = (is_recurring && Array.isArray(selectedDays)) 
        ? selectedDays 
        : [calculatedDay !== undefined ? calculatedDay : null];

      for (const day of daysToInsert) {
        const cleanDay = day !== null ? parseInt(day, 10) : null;
        const cleanOrder = parseInt(order_sequence, 10) || 0;

        const query = `
          INSERT INTO public.user_routes (
            company_id, user_id, local_id, visit_date, start_time, 
            order_sequence, warehouse_id, status, 
            day_of_week, schedule_group_id, is_recurring, origin,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, $10, $11, NOW(), NOW()) 
          ON CONFLICT (user_id, local_id, visit_date, day_of_week) 
          DO UPDATE SET 
            start_time = EXCLUDED.start_time, 
            origin = EXCLUDED.origin, -- 🚩 Actualizamos el origen en caso de conflicto
            schedule_group_id = COALESCE(EXCLUDED.schedule_group_id, public.user_routes.schedule_group_id),
            updated_at = NOW()
          RETURNING *;
        `;
        
        const result = await client.query(query, [
          company_id, user_id, local_id, 
          is_recurring ? null : visit_date, 
          start_time, cleanOrder, warehouse_id || null,
          cleanDay, schedule_group_id || null, is_recurring || false,
          origin || 'INDIVIDUAL' // 🚩 Valor por defecto si no viene
        ]);
        
        if (result.rows.length > 0) results.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error en bulkCreateRoutes Service:", error.message);
    throw error;
  } finally {
    client.release();
  }
};

/* =========================================================
   OBTENER RUTAS POR USUARIO Y FECHA (Timeline)
========================================================= */
export const getRoutesByUserAndDate = async (company_id, user_id, date) => {
  try {
    const query = `
      SELECT 
        ur.id, ur.visit_date, ur.start_time, ur.status, ur.order_sequence, 
        ur.day_of_week, ur.is_recurring, ur.lat_in, ur.lng_in, ur.check_in,
        ur.origin, -- 🚩 Añadido para lógica de cliente
        l.cadena, l.direccion, l.lat as local_lat, l.lng as local_lng,
        c.name as comuna_name,
        u.first_name, u.last_name
      FROM public.user_routes ur
      JOIN public.locales l ON ur.local_id = l.id
      LEFT JOIN public.comunas c ON l.comuna_id = c.id
      JOIN public.users u ON ur.user_id = u.id
      WHERE ur.user_id = $2
        AND ($1::uuid IS NULL OR ur.company_id = $1)
        AND ur.deleted_at IS NULL
        AND (
          (ur.is_recurring = false AND ur.visit_date::date = $3::date)
          OR 
          (ur.is_recurring = true AND ur.day_of_week = EXTRACT(DOW FROM $3::date)::integer)
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
   MANTENCIÓN DE RUTAS
========================================================= */
export const getRouteDetail = async (id, company_id) => {
  const result = await db.query(
    `SELECT ur.*, l.lat as local_lat, l.lng as local_lng 
     FROM public.user_routes ur
     JOIN public.locales l ON ur.local_id = l.id
     WHERE ur.id = $1 AND ($2::uuid IS NULL OR ur.company_id = $2)`,
    [id, company_id]
  );
  return result.rows[0];
};

export const updateRoute = async (id, data) => {
  const { user_id, local_id, start_time, selectedDays, visit_date, company_id } = data;
  
  const routeInfo = await db.query(
    `SELECT schedule_group_id, is_recurring, origin FROM public.user_routes WHERE id = $1`, [id]
  );
  
  if (routeInfo.rows.length === 0) throw new Error("Ruta no encontrada");
  
  const { schedule_group_id: groupId, is_recurring: isRec, origin } = routeInfo.rows[0];

  if (groupId && isRec) {
    await db.query(`DELETE FROM public.user_routes WHERE schedule_group_id = $1 AND ($2::uuid IS NULL OR company_id = $2)`, [groupId, company_id]);
    
    const tasks = [{
      company_id, user_id, local_id, visit_date: null, start_time,
      selectedDays, schedule_group_id: groupId, is_recurring: true, origin: 'TURNO'
    }];
    
    const updatedRows = await bulkCreateRoutes(tasks);
    return updatedRows[0];
  } else {
    const result = await db.query(
      `UPDATE public.user_routes SET user_id = $1, local_id = $2, start_time = $3, visit_date = $4, updated_at = NOW()
       WHERE id = $5 AND ($6::uuid IS NULL OR company_id = $6) RETURNING *`,
      [user_id, local_id, start_time, visit_date || null, id, company_id]
    );
    return result.rows[0];
  }
};

export const deleteRoute = async (company_id, route_id) => {
  const routeInfo = await db.query(`SELECT schedule_group_id FROM public.user_routes WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)`, [route_id, company_id]);
  if (routeInfo.rows.length === 0) throw new Error("Ruta no encontrada");
  const groupId = routeInfo.rows[0]?.schedule_group_id;
  if (groupId) {
    await db.query(`DELETE FROM public.user_routes WHERE schedule_group_id = $1 AND ($2::uuid IS NULL OR company_id = $2)`, [groupId, company_id]);
  } else {
    await db.query(`DELETE FROM public.user_routes WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)`, [route_id, company_id]);
  }
  return { message: "Planificación eliminada" };
};

export const resetRouteStatus = async (id, company_id) => {
  try {
    const query = `
      UPDATE public.user_routes 
      SET status = 'PENDING', check_in = NULL, lat_in = NULL, lng_in = NULL,
          distance_meters = NULL, is_valid_gps = false, updated_at = NOW()
      WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, company_id]);
    await db.query(`DELETE FROM public.visits WHERE route_id = $1`, [id]);
    return rows[0];
  } catch (error) {
    throw error;
  }
};