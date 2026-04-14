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
   OPERACIÓN MERCADERISTA
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

    const query = `
      UPDATE public.user_routes 
      SET 
        status = 'IN_PROGRESS', 
        check_in = CURRENT_TIMESTAMP, 
        lat_in = $1, 
        lng_in = $2,
        distance_meters = $3,
        is_valid_gps = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 ${!isRoot ? 'AND company_id = $6' : ''}
      RETURNING *;
    `;
    
    const params = [parseFloat(lat_in), parseFloat(lng_in), Math.round(distance), isValidGps, id];
    if (!isRoot) params.push(targetCompanyId);

    const result = await db.query(query, params);
    res.json({ isValid: isValidGps, data: result.rows[0] });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const finishVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, role } = req.user;
    const isRoot = role === 'ROOT';

    const query = `
      UPDATE public.user_routes 
      SET status = 'COMPLETED', check_out = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 ${!isRoot ? 'AND company_id = $2' : ''}
      RETURNING *;
    `;
    const params = !isRoot ? [id, company_id] : [id];
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const { id: user_id, company_id, role } = req.user;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const targetUserId = (role === 'ROOT' && req.query.userId) ? req.query.userId : user_id;
    const targetCompanyId = role === 'ROOT' ? null : company_id;

    const tasks = await routeService.getRoutesByUserAndDate(targetCompanyId, targetUserId, date);
    res.json(tasks || []);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener agenda" });
  }
};

/* =========================================================
   GESTIÓN ADMIN / ROOT / SUPERVISOR
========================================================= */

/**
 * 📊 REPORTE DE ASISTENCIA E HISTORIAL MEJORADO
 * Soporta búsqueda global (search) y filtrado por fecha (date).
 */
export const getAttendanceReport = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const { date, search } = req.query;
    
    const targetCompanyId = (role === 'ROOT' && req.query.company_id) 
      ? req.query.company_id 
      : company_id;

    if (!targetCompanyId) return res.status(400).json({ message: "ID de empresa requerido" });

    let query = `
      SELECT 
        r.id, u.first_name, u.last_name, u.rut as worker_id, 
        l.cadena as local_name, l.codigo_local as local_code, r.status,
        r.visit_date, -- 🚩 Necesario para mostrar la fecha en el historial
        TO_CHAR(r.start_time, 'HH24:MI') as plan_in, 
        TO_CHAR(r.check_in, 'HH24:MI') as check_in,
        CASE 
          WHEN r.check_in IS NOT NULL AND r.check_out IS NOT NULL 
          THEN ROUND(EXTRACT(EPOCH FROM (r.check_out - r.check_in))/60)
          ELSE NULL 
        END as working_time,
        ROUND(EXTRACT(EPOCH FROM (r.check_in::time - r.start_time::time))/60) as diff 
      FROM public.user_routes r 
      JOIN public.users u ON r.user_id = u.id 
      JOIN public.locales l ON r.local_id = l.id 
      WHERE r.company_id = $1 AND r.deleted_at IS NULL
    `;

    const params = [targetCompanyId];

    // 🚩 LÓGICA DE BÚSQUEDA GLOBAL (Ignora fecha si hay término de búsqueda)
    if (search && search.trim().length > 2) {
      query += ` AND (
        u.first_name ILIKE $2 OR 
        u.last_name ILIKE $2 OR 
        l.cadena ILIKE $2 OR 
        l.codigo_local ILIKE $2
      )`;
      params.push(`%${search}%`);
    } else {
      // Filtrado normal por fecha (Hoy o Historial)
      const reportDate = date || new Date().toISOString().split('T')[0];
      query += ` AND (
        DATE(r.check_in) = $2 OR 
        r.visit_date = $2 OR 
        (r.is_recurring = true AND r.day_of_week = EXTRACT(DOW FROM $2::date))
      )`;
      params.push(reportDate);
    }

    query += ` ORDER BY r.visit_date DESC, r.start_time ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ ERROR REPORTE ASISTENCIA:", error.message);
    res.status(500).json({ message: "Error al generar reporte" });
  }
};

export const createRoute = async (req, res) => {
  try {
    const { user_id, local_id, start_time, visit_date, selectedDays, is_recurring } = req.body;
    const company_id = req.user.role === 'ROOT' ? (req.body.company_id || req.user.company_id) : req.user.company_id;

    let tasks = [];
    if (is_recurring && selectedDays?.length > 0) {
      const group = crypto.randomUUID();
      tasks = selectedDays.map(day => ({
        company_id, user_id, local_id, start_time,
        day_of_week: parseInt(day), schedule_group_id: group, is_recurring: true
      }));
    } else {
      tasks = [{ company_id, user_id, local_id, start_time, visit_date, is_recurring: false }];
    }

    const result = await routeService.bulkCreateRoutes(tasks);
    res.status(201).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getRoutesByUser = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const { userId } = req.params;
    const filterCompany = role === 'ROOT' ? null : company_id;
    const routes = await routeService.getRoutesByUser(filterCompany, userId);
    res.json(routes || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getRoutes = (req, res) => 
  routeService.getRoutesByCompany(req.user.role === 'ROOT' ? req.query.company_id : req.user.company_id).then(r => res.json(r));

export const updateRoute = (req, res) => 
  routeService.updateRoute(req.params.id, req.body).then(r => res.json(r));

export const deleteRoute = (req, res) => 
  routeService.deleteRoute(req.user.company_id, req.params.id).then(r => res.json(r));

export const getLiveMonitoring = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const filterCompany = role === 'ROOT' ? (req.query.company_id || null) : company_id;
    const query = `
      SELECT u.id as user_id, u.first_name, u.last_name, r.id as route_id, r.status, r.lat_in, r.lng_in, r.check_in as active_since, COALESCE(l.cadena, 'S/N') as local_nombre
      FROM public.users u JOIN public.user_routes r ON u.id = r.user_id LEFT JOIN public.locales l ON r.local_id = l.id
      WHERE r.status = 'IN_PROGRESS' ${filterCompany ? 'AND r.company_id = $1' : ''} ORDER BY r.check_in DESC;
    `;
    const result = await db.query(query, filterCompany ? [filterCompany] : []);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error en monitoreo" });
  }
};

export const saveVisitPhoto = async (req, res) => {
  try {
    const routeId = req.params.id;
    const { tipo_evidencia } = req.body;
    const query = `INSERT INTO public.visit_photos (visit_id, company_id, image_url, evidence_type) VALUES ($1, $2, $3, $4) RETURNING *;`;
    const result = await db.query(query, [routeId, req.user.company_id, req.file.path, tipo_evidencia]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetCheckIn = (req, res) => 
  routeService.resetRouteStatus(req.params.id, req.user.company_id).then(r => res.json(r));

export const addVisitScan = async (req, res) => {
  try {
    const query = `INSERT INTO public.visit_scans (visit_id, company_id, barcode) VALUES ($1, $2, $3) RETURNING *;`;
    const result = await db.query(query, [req.params.id, req.user.company_id, req.body.barcode]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};