import * as routeService from "./routes.service.js";
import crypto from "crypto";

/* =========================================================
   OBTENER MIS TAREAS (Timeline del Reponedor)
========================================================= */
export const getMyTasks = async (req, res) => {
  try {
    const user_id = req.user.id;
    const company_id = req.user.company_id;
    
    // Capturamos la fecha del query (?date=YYYY-MM-DD) o usamos hoy
    const dateToQuery = req.query.date || new Date().toISOString().split('T')[0];

    const tasks = await routeService.getRoutesByUserAndDate(company_id, user_id, dateToQuery);
    
    const formattedTasks = (tasks || []).map(t => ({
      ...t,
      initials: `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}`.toUpperCase(),
      user_name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
      // Calculamos el día de la semana para la UI si es necesario
      day_of_week_name: new Date(t.visit_date || dateToQuery).toLocaleDateString('es-CL', { weekday: 'long' })
    }));

    res.json(formattedTasks);
  } catch (error) {
    console.error("❌ ERROR getMyTasks:", error.message);
    res.status(400).json({ message: "Error al obtener la agenda" });
  }
};

/* =========================================================
   CREAR RUTA (UNIFICADA: Única o Recurrente)
========================================================= */
export const createRoute = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { 
      user_id, local_id, start_time, 
      visit_date, selectedDays, is_recurring 
    } = req.body;

    let tasksToCreate = [];

    if (is_recurring && selectedDays?.length > 0) {
      // 🔄 CASO RECURRENTE: Creamos un grupo para varios días de la semana
      const schedule_group_id = crypto.randomUUID();
      tasksToCreate = selectedDays.map(day => ({
        company_id,
        user_id,
        local_id,
        start_time: start_time || '09:00:00',
        visit_date: null, // No tiene fecha fija
        day_of_week: day,
        schedule_group_id,
        is_recurring: true,
        status: 'PENDING'
      }));
    } else {
      // 📅 CASO FECHA ÚNICA: Una sola visita un día específico
      tasksToCreate = [{
        company_id,
        user_id,
        local_id,
        start_time: start_time || '09:00:00',
        visit_date: visit_date, // Fecha exacta elegida en el calendario
        day_of_week: visit_date ? new Date(visit_date).getDay() : null,
        is_recurring: false,
        status: 'PENDING'
      }];
    }

    const result = await routeService.bulkCreateRoutes(tasksToCreate);
    res.status(201).json({ message: "Ruta(s) creada(s) con éxito", data: result });
  } catch (error) {
    console.error("❌ ERROR createRoute:", error.message);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================================
   ACTUALIZAR RUTA (Soporta cambio de Fecha o Días)
========================================================= */
export const updateRoute = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    
    // Enviamos todo el body al service para que él decida si actualiza
    // una sola fila o un grupo recurrente.
    const result = await routeService.updateRoute(id, { ...req.body, company_id });
    
    if (!result) return res.status(404).json({ message: "Ruta no encontrada" });

    res.json({ message: "Actualización exitosa", data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================================
   CHECK-IN CON GPS
========================================================= */
export const checkIn = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    const { lat, lng } = req.body;

    const route = await routeService.getRouteDetail(id, company_id);
    if (!route) return res.status(404).json({ message: "Ruta no encontrada" });

    const distance = calculateDistance(lat, lng, route.local_lat, route.local_lng);
    const isValidGps = distance <= 250; 

    const result = await routeService.registerCheckInWithGps({
      id, company_id, lat_in: lat, lng_in: lng,
      distance_meters: Math.round(distance),
      is_valid_gps: isValidGps
    });

    res.json({ 
      isValid: isValidGps, 
      distance: Math.round(distance), 
      message: isValidGps ? "Check-in exitoso" : "Estás fuera del rango permitido",
      data: result 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================================
   AUXILIARES Y GESTIÓN ADMIN
========================================================= */

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

export const getRoutes = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const routes = await routeService.getRoutesByCompany(company_id);
    res.json(routes || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getRoutesByUser = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { userId } = req.params;
    const routes = await routeService.getRoutesByUser(company_id, userId);
    res.json(routes || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteRoute = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    const result = await routeService.deleteRoute(company_id, id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};