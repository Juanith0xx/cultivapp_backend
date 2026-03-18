import db from "../../database/db.js";
import xlsx from "xlsx";

/* =========================================================
   CREAR RUTAS (MANUAL / MASIVO OPTIMIZADO)
========================================================= */
export const bulkCreateRoutes = async (tasks) => {
  const results = [];
  // Usamos un loop para validar cada una antes de insertar 
  // (O podrías usar un UNNEST si prefieres rendimiento puro)
  for (const task of tasks) {
    const { 
      company_id, user_id, local_id, 
      visit_date, start_time, order_sequence, warehouse_id 
    } = task;

    // 🔒 Evitar duplicados exactos en el mismo día
    const duplicateCheck = await db.query(
      `SELECT id FROM public.user_routes 
       WHERE user_id = $1 AND local_id = $2 AND visit_date = $3`,
      [user_id, local_id, visit_date]
    );

    if (duplicateCheck.rows.length === 0) {
      const result = await db.query(
        `INSERT INTO public.user_routes (
          company_id, user_id, local_id, visit_date, start_time, 
          order_sequence, warehouse_id, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW(), NOW()) RETURNING *`,
        [company_id, user_id, local_id, visit_date, start_time, order_sequence || 0, warehouse_id || null]
      );
      results.push(result.rows[0]);
    }
  }
  return results;
};

/* =========================================================
   OBTENER DETALLE PARA GPS
   Obtiene la ruta y las coordenadas del local asociado
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
   OBTENER RUTAS POR USUARIO (Calendario Trabajador)
========================================================= */
export const getRoutesByUser = async (company_id, user_id) => {
  const result = await db.query(
    `SELECT ur.id, ur.visit_date, ur.start_time, ur.status, ur.order_sequence,
            ur.check_in, ur.lat_in, ur.lng_in, ur.is_valid_gps,
            l.cadena, l.direccion, l.lat, l.lng,
            c.name as comuna_name
     FROM public.user_routes ur
     JOIN public.locales l ON ur.local_id = l.id
     LEFT JOIN public.comunas c ON l.comuna_id = c.id
     WHERE ur.company_id = $1 AND ur.user_id = $2
     ORDER BY ur.visit_date ASC, ur.order_sequence ASC`,
    [company_id, user_id]
  );
  return result.rows;
};

/* =========================================================
   OBTENER RUTAS POR EMPRESA (Admin Dashboard)
========================================================= */
export const getRoutesByCompany = async (company_id) => {
  const result = await db.query(
    `SELECT ur.*,
            u.first_name, u.last_name, u.rut as user_rut,
            l.cadena, l.direccion,
            c.name as comuna_name
     FROM public.user_routes ur
     JOIN public.users u ON ur.user_id = u.id
     JOIN public.locales l ON ur.local_id = l.id
     LEFT JOIN public.comunas c ON l.comuna_id = c.id
     WHERE ur.company_id = $1
     ORDER BY ur.visit_date DESC, ur.start_time ASC`,
    [company_id]
  );
  return result.rows;
};

/* =========================================================
   ELIMINAR RUTA
========================================================= */
export const deleteRoute = async (company_id, route_id) => {
  const result = await db.query(
    `DELETE FROM public.user_routes WHERE id = $1 AND company_id = $2 RETURNING id`,
    [route_id, company_id]
  );
  if (result.rows.length === 0) throw new Error("Ruta no encontrada");
  return { message: "Ruta eliminada correctamente" };
};