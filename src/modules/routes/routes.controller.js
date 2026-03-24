import * as routeService from "./routes.service.js";
import crypto from "crypto";

/**
 * Auxiliar: Cálculo de distancia entre dos puntos (Fórmula de Haversine)
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
    const company_id = req.user.company_id;
    const { id } = req.params; 
    const { lat_in, lng_in } = req.body; 

    if (!lat_in || !lng_in) return res.status(400).json({ message: "GPS incompleto" });

    const route = await routeService.getRouteDetail(id, company_id);
    if (!route) return res.status(404).json({ message: "Ruta no encontrada" });

    const distance = calculateDistance(
      parseFloat(lat_in), parseFloat(lng_in), 
      parseFloat(route.local_lat), parseFloat(route.local_lng)
    );

    const isValidGps = distance <= 250; 

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
    const tasks = await routeService.getRoutesByUserAndDate(
      req.user.company_id, req.user.id, req.query.date || new Date().toISOString().split('T')[0]
    );
    res.json(tasks || []);
  } catch (error) {
    res.status(400).json({ message: "Error agenda" });
  }
};

/* =========================================================
   GESTIÓN ADMIN / ROOT
========================================================= */

export const createRoute = async (req, res) => {
  try {
    const isRoot = req.user.role === 'ROOT';
    const company_id = isRoot ? req.body.company_id : req.user.company_id;

    if (!company_id) return res.status(400).json({ message: "Falta company_id" });

    const { user_id, local_id, start_time, visit_date, selectedDays, is_recurring } = req.body;
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

// 🚩 AQUÍ ESTABA EL ERROR: Faltaba el export
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
    const company_id = isRoot ? (req.body.company_id || null) : req.user.company_id;
    const result = await routeService.deleteRoute(company_id, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};