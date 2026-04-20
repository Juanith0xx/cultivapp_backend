import * as routeService from "./routes.service.js";
import crypto from "crypto";
import db from "../../database/db.js"; 

/**
 * Auxiliar: Cálculo de distancia (Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* =========================================================
   CARGA MASIVA (DEBUG DE LONGITUD)
========================================================= */

export const bulkCreate = async (req, res) => {
  try {
    // Aceptamos datos tanto en req.body.routes como en req.body directo
    const rawData = req.body.routes || req.body;
    const company_id = req.user.company_id;

    console.log("🔍 [DEBUG] Cantidad de filas recibidas:", Array.isArray(rawData) ? rawData.length : "No es array");

    if (!Array.isArray(rawData) || rawData.length === 0) {
      console.error("❌ [ERROR 400] El array llegó vacío desde el frontend.");
      return res.status(400).json({ 
        message: "El archivo se procesó pero no se encontraron filas válidas para cargar. Revisa que los RUTs y Códigos de Local existan en el sistema." 
      });
    }

    const processedRoutes = [];
    let skipCount = 0;

    for (const fila of rawData) {
      // Normalizamos el nombre del turno para el match
      const nombreTurno = fila.Tipo_de_Turno?.toString().trim().toUpperCase();
      const rol = fila.Rol?.toString().trim();

      // Buscamos configuración horaria
      const turnoRes = await db.query(
        `SELECT entrada, salida FROM public.turnos_config 
         WHERE company_id = $1 
         AND UPPER(TRIM(nombre_turno)) = $2 
         AND TRIM(categoria_rol) = $3 
         LIMIT 1`,
        [company_id, nombreTurno, rol]
      );

      const config = turnoRes.rows[0];
      const hora_entrada = config ? config.entrada : (fila.Entrada || "08:00");

      // VITAL: Verificar que el frontend envió los IDs ya resueltos
      if (fila.user_id && fila.local_id) {
        processedRoutes.push({
          company_id,
          user_id: fila.user_id,
          local_id: fila.local_id,
          visit_date: fila.Fecha, 
          start_time: hora_entrada,
          is_recurring: false
        });
      } else {
        skipCount++;
      }
    }

    if (processedRoutes.length === 0) {
      return res.status(200).json({ 
        success: false, 
        message: `Filas procesadas: ${rawData.length}. Filas válidas: 0. Verifica que los RUTs y Códigos de Local del Excel coincidan con los del sistema.`,
        count: 0,
        skipped: skipCount
      });
    }

    const result = await routeService.bulkCreateRoutes(processedRoutes);
    
    res.status(201).json({ 
      success: true, 
      message: `Carga exitosa. Se agendaron ${result.length} visitas.`,
      count: result.length
    });

  } catch (error) {
    console.error("❌ [BULK FATAL ERROR]:", error.message);
    res.status(500).json({ message: "Error interno: " + error.message });
  }
};

/* =========================================================
   RESTO DE MÉTODOS (OPERACIÓN Y GESTIÓN)
========================================================= */

export const checkIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat_in, lng_in } = req.body;
    const { company_id, role } = req.user;
    const isRoot = role === 'ROOT';
    const targetCompanyId = isRoot ? (req.body.company_id || company_id) : company_id;

    if (!lat_in || !lng_in) return res.status(400).json({ message: "GPS incompleto" });

    const route = await routeService.getRouteDetail(id, targetCompanyId);
    if (!route) return res.status(404).json({ message: "Ruta no encontrada." });

    const distance = calculateDistance(
      parseFloat(lat_in), parseFloat(lng_in), 
      parseFloat(route.local_lat), parseFloat(route.local_lng)
    );

    const isValidGps = distance <= 3000; 

    const result = await db.query(`
      UPDATE public.user_routes 
      SET status = 'IN_PROGRESS', check_in = CURRENT_TIMESTAMP, lat_in = $1, lng_in = $2, distance_meters = $3, is_valid_gps = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 ${!isRoot ? 'AND company_id = $6' : ''}
      RETURNING *;
    `, [parseFloat(lat_in), parseFloat(lng_in), Math.round(distance), isValidGps, id, ...(!isRoot ? [targetCompanyId] : [])]);
    
    res.json({ isValid: isValidGps, data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const finishVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const isRoot = req.user.role === 'ROOT';
    const result = await db.query(`
      UPDATE public.user_routes SET status = 'COMPLETED', check_out = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 ${!isRoot ? 'AND company_id = $2' : ''} RETURNING *;
    `, isRoot ? [id] : [id, req.user.company_id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const tasks = await routeService.getRoutesByUserAndDate(
      req.user.role === 'ROOT' ? null : req.user.company_id, 
      (req.user.role === 'ROOT' && req.query.userId) ? req.query.userId : req.user.id, 
      date
    );
    res.json(tasks || []);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener agenda" });
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const { date, search } = req.query;
    const targetCompanyId = (role === 'ROOT' && req.query.company_id) ? req.query.company_id : company_id;
    
    let query = `
      SELECT r.id, u.first_name, u.last_name, u.rut as worker_id, l.cadena as local_name, l.codigo_local as local_code, r.status, r.visit_date,
             TO_CHAR(r.start_time, 'HH24:MI') as plan_in, TO_CHAR(r.check_in, 'HH24:MI') as check_in,
             CASE WHEN r.check_in IS NOT NULL AND r.check_out IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (r.check_out - r.check_in))/60) ELSE NULL END as working_time
      FROM public.user_routes r JOIN public.users u ON r.user_id = u.id JOIN public.locales l ON r.local_id = l.id 
      WHERE r.company_id = $1 AND r.deleted_at IS NULL
    `;
    const params = [targetCompanyId];
    if (search?.trim().length > 2) {
      query += ` AND (u.first_name ILIKE $2 OR u.last_name ILIKE $2 OR l.cadena ILIKE $2 OR l.codigo_local ILIKE $2)`;
      params.push(`%${search}%`);
    } else {
      const reportDate = date || new Date().toISOString().split('T')[0];
      query += ` AND (DATE(r.check_in) = $2 OR r.visit_date = $2 OR (r.is_recurring = true AND r.day_of_week = EXTRACT(DOW FROM $2::date)))`;
      params.push(reportDate);
    }
    const result = await db.query(query + " ORDER BY r.visit_date DESC", params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error al generar reporte" });
  }
};

export const createRoute = async (req, res) => {
  try {
    const { user_id, local_id, start_time, visit_date, selectedDays, is_recurring } = req.body;
    const company_id = req.user.role === 'ROOT' ? (req.body.company_id || req.user.company_id) : req.user.company_id;
    let tasks = is_recurring && selectedDays?.length > 0 
      ? selectedDays.map(day => ({ company_id, user_id, local_id, start_time, day_of_week: parseInt(day), schedule_group_id: crypto.randomUUID(), is_recurring: true }))
      : [{ company_id, user_id, local_id, start_time, visit_date, is_recurring: false }];
    const result = await routeService.bulkCreateRoutes(tasks);
    res.status(201).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getRoutesByUser = (req, res) => routeService.getRoutesByUser(req.user.role === 'ROOT' ? null : req.user.company_id, req.params.userId).then(r => res.json(r));
export const getRoutes = (req, res) => routeService.getRoutesByCompany(req.user.role === 'ROOT' ? req.query.company_id : req.user.company_id).then(r => res.json(r));
export const updateRoute = (req, res) => routeService.updateRoute(req.params.id, req.body).then(r => res.json(r));
export const deleteRoute = (req, res) => routeService.deleteRoute(req.user.company_id, req.params.id).then(r => res.json(r));

export const getLiveMonitoring = async (req, res) => {
  try {
    const filterCompany = req.user.role === 'ROOT' ? (req.query.company_id || null) : req.user.company_id;
    const result = await db.query(`
      SELECT u.id as user_id, u.first_name, u.last_name, r.id as route_id, r.status, r.lat_in, r.lng_in, r.check_in as active_since, l.cadena as local_nombre
      FROM public.users u JOIN public.user_routes r ON u.id = r.user_id LEFT JOIN public.locales l ON r.local_id = l.id
      WHERE r.status = 'IN_PROGRESS' ${filterCompany ? 'AND r.company_id = $1' : ''} ORDER BY r.check_in DESC;
    `, filterCompany ? [filterCompany] : []);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error en monitoreo" });
  }
};

export const saveVisitPhoto = async (req, res) => {
  try {
    const result = await db.query(`INSERT INTO public.visit_photos (visit_id, company_id, image_url, evidence_type) VALUES ($1, $2, $3, $4) RETURNING *;`, [req.params.id, req.user.company_id, req.file.path, req.body.tipo_evidencia]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetCheckIn = (req, res) => routeService.resetRouteStatus(req.params.id, req.user.company_id).then(r => res.json(r));

export const addVisitScan = async (req, res) => {
  try {
    const result = await db.query(`INSERT INTO public.visit_scans (visit_id, company_id, barcode) VALUES ($1, $2, $3) RETURNING *;`, [req.params.id, req.user.company_id, req.body.barcode]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};