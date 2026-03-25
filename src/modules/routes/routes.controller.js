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
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? (req.body.company_id || req.user.company_id) : req.user.company_id;
    const { id } = req.params; 
    const { lat_in, lng_in } = req.body; 

    if (!lat_in || !lng_in) return res.status(400).json({ message: "GPS incompleto" });

    const route = await routeService.getRouteDetail(id, company_id);
    if (!route) return res.status(404).json({ message: "Ruta no encontrada" });

    const distance = calculateDistance(
      parseFloat(lat_in), parseFloat(lng_in), 
      parseFloat(route.local_lat), parseFloat(route.local_lng)
    );

    const isValidGps = distance <= 3000; 

    const result = await routeService.registerCheckInWithGps({
      id, company_id, lat_in: parseFloat(lat_in), lng_in: parseFloat(lng_in),
      distance_meters: Math.round(distance), is_valid_gps: isValidGps
    });

    if (!isValidGps) {
      return res.status(400).json({ isValid: false, message: `Fuera de rango (${Math.round(distance)}m)` });
    }

    res.json({ isValid: true, message: "Check-in exitoso", data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const isRoot = req.user.role === 'ROOT';
    const user_id = isRoot ? (req.query.userId || req.user.id) : req.user.id;
    const company_id = isRoot ? null : req.user.company_id;
    
    const tasks = await routeService.getRoutesByUserAndDate(
      company_id, user_id, req.query.date || new Date().toISOString().split('T')[0]
    );
    res.json(tasks || []);
  } catch (error) {
    res.status(400).json({ message: "Error agenda" });
  }
};

export const finishVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? null : req.user.company_id;

    const query = `
      UPDATE public.user_routes 
      SET status = 'COMPLETED', check_out = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 ${company_id ? 'AND company_id = $2' : ''}
      RETURNING *;
    `;
    const params = company_id ? [id, company_id] : [id];
    const result = await db.query(query, params);

    if (result.rowCount === 0) return res.status(404).json({ message: "Error al finalizar" });
    res.json({ success: true, message: "Visita finalizada", data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   GESTIÓN ADMIN / ROOT
========================================================= */

export const createRoute = async (req, res) => {
  try {
    const isRoot = req.user.role === 'ROOT';
    const { user_id, local_id, start_time, visit_date, selectedDays, is_recurring } = req.body;
    let company_id = isRoot ? req.body.company_id : req.user.company_id;

    if (isRoot && !company_id && local_id) {
      const localRes = await db.query('SELECT company_id FROM public.locales WHERE id = $1', [local_id]);
      if (localRes.rows.length > 0) company_id = localRes.rows[0].company_id;
    }

    if (!company_id) return res.status(400).json({ message: "Empresa no determinada." });

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
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? (req.query.company_id || null) : req.user.company_id;
    const routes = await routeService.getRoutesByCompany(company_id);
    res.json(routes || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getRoutesByUser = async (req, res) => {
  try {
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? null : req.user.company_id;
    const routes = await routeService.getRoutesByUser(company_id, req.params.userId);
    res.json(routes || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================================
   📸 EVIDENCIAS Y MONITOREO GPS
========================================================= */

// 🚩 ESTA ES LA FUNCIÓN QUE NODE NO ENCONTRABA
export const saveVisitPhoto = async (req, res) => {
  try {
    const { visit_id } = req.body; 
    if (!req.file) return res.status(400).json({ message: "No se recibió imagen." });
    const imageUrl = `/uploads/visits/${req.file.filename}`;
    const query = `INSERT INTO public.visit_photos (visit_id, image_url) VALUES ($1, $2) RETURNING *;`;
    const result = await db.query(query, [visit_id, imageUrl]);
    res.status(201).json({ success: true, photo: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLiveMonitoring = async (req, res) => {
  try {
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? null : req.user.company_id;

    // 🚩 CAMBIO: Usamos l.cadena para evitar el error "column l.nombre does not exist"
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
      ${company_id ? 'AND r.company_id = $1' : ''}
      ORDER BY r.check_in DESC
    `;

    const params = company_id ? [company_id] : [];
    const result = await db.query(query, params);

    const data = result.rows.map(row => ({
      ...row, 
      lat_in: parseFloat(row.lat_in), 
      lng_in: parseFloat(row.lng_in)
    }));

    res.json(data);
  } catch (error) {
    console.error("❌ ERROR EN MONITOREO:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   🔄 OTROS
========================================================= */

export const resetCheckIn = async (req, res) => {
  try {
    const { id } = req.params;
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? null : req.user.company_id;
    const result = await routeService.resetRouteStatus(id, company_id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateRoute = async (req, res) => {
  try {
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? (req.body.company_id || null) : req.user.company_id;
    const result = await routeService.updateRoute(req.params.id, { ...req.body, company_id });
    res.json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteRoute = async (req, res) => {
  try {
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? null : req.user.company_id;
    const result = await routeService.deleteRoute(company_id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};