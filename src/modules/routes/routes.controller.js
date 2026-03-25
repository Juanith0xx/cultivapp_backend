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
    const company_id = req.user.role === 'ROOT' ? (req.body.company_id || req.user.company_id) : req.user.company_id;

    if (!lat_in || !lng_in) return res.status(400).json({ message: "GPS incompleto" });

    const route = await routeService.getRouteDetail(id, company_id);
    if (!route) return res.status(404).json({ message: "Ruta no encontrada." });

    const distance = calculateDistance(
      parseFloat(lat_in), parseFloat(lng_in), 
      parseFloat(route.local_lat), parseFloat(route.local_lng)
    );

    const isValidGps = distance <= 3000; 
    const result = await routeService.registerCheckInWithGps({
      id, company_id, lat_in: parseFloat(lat_in), lng_in: parseFloat(lng_in),
      distance_meters: Math.round(distance), is_valid_gps: isValidGps
    });

    res.json({ isValid: isValidGps, message: isValidGps ? "Check-in exitoso" : `Fuera de rango (${Math.round(distance)}m)`, data: result });
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

    if (result.rowCount === 0) return res.status(404).json({ message: "No autorizado o ruta inexistente" });
    res.json({ success: true, message: "Visita finalizada", data: result.rows[0] });
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
   GESTIÓN ADMIN / ROOT
========================================================= */

export const createRoute = async (req, res) => {
  try {
    const { user_id, local_id, start_time, visit_date, selectedDays, is_recurring } = req.body;
    const company_id = req.user.role === 'ROOT' ? (req.body.company_id || req.user.company_id) : req.user.company_id;

    if (!company_id) return res.status(400).json({ message: "Empresa requerida" });

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

export const getRoutes = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const filterCompany = role === 'ROOT' ? (req.query.company_id || null) : company_id;
    const routes = await routeService.getRoutesByCompany(filterCompany);
    res.json(routes || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getRoutesByUser = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const filterCompany = role === 'ROOT' ? null : company_id;
    const routes = await routeService.getRoutesByUser(filterCompany, req.params.userId);
    res.json(routes || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, role } = req.user;
    const isRoot = role === 'ROOT';
    
    const result = await routeService.updateRoute(id, { 
      ...req.body, 
      company_id: isRoot ? (req.body.company_id || null) : company_id 
    });
    res.json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, role } = req.user;
    const result = await routeService.deleteRoute(role === 'ROOT' ? null : company_id, id);
    res.json({ success: true, message: "Ruta eliminada", result });
  } catch (error) {
    res.status(400).json({ message: "Error al eliminar" });
  }
};

/* =========================================================
   📸 EVIDENCIAS Y MONITOREO GPS
========================================================= */

export const saveVisitPhoto = async (req, res) => {
  try {
    const { visit_id } = req.body; 
    if (!req.file) return res.status(400).json({ message: "No se recibió imagen." });
    const imageUrl = `/uploads/visits/${req.file.filename}`;
    const query = `INSERT INTO public.visit_photos (visit_id, image_url) VALUES ($1, $2) RETURNING *;`;
    const result = await db.query(query, [visit_id, imageUrl]);
    res.status(201).json({ success: true, photo: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Error al guardar evidencia" });
  }
};

export const getLiveMonitoring = async (req, res) => {
  try {
    const { company_id, role } = req.user;
    const isRoot = role === 'ROOT';
    const filterCompany = isRoot ? (req.query.company_id || null) : company_id;

    const query = `
      SELECT 
        u.id as user_id, u.first_name, u.last_name, 
        r.id as route_id, r.status, r.lat_in, r.lng_in,
        r.check_in as active_since, 
        COALESCE(l.cadena, 'Sin nombre') as local_nombre
      FROM public.users u
      INNER JOIN public.user_routes r ON u.id = r.user_id
      LEFT JOIN public.locales l ON r.local_id = l.id
      WHERE r.status = 'IN_PROGRESS' 
      AND r.lat_in IS NOT NULL
      ${filterCompany ? 'AND r.company_id = $1' : ''}
      ORDER BY r.check_in DESC
    `;

    const params = filterCompany ? [filterCompany] : [];
    const result = await db.query(query, params);
    const data = result.rows.map(row => ({
      ...row, lat_in: parseFloat(row.lat_in), lng_in: parseFloat(row.lng_in)
    }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error en monitoreo multi-tenant" });
  }
};

/* =========================================================
   🔄 OTROS
========================================================= */

export const resetCheckIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, role } = req.user;
    const targetCompanyId = role === 'ROOT' ? null : company_id;

    const result = await routeService.resetRouteStatus(id, targetCompanyId);
    res.json({ success: true, message: "Ruta reseteada", data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};