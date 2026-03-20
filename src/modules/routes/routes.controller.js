import * as routeService from "./routes.service.js";
import crypto from "crypto";

/**
 * Auxiliar: Cálculo de distancia entre dos puntos (Fórmula de Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la tierra en metros
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
   CHECK-IN CON GPS (Optimizado para lat_in / lng_in)
========================================================= */
export const checkIn = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params; 
    const { lat_in, lng_in } = req.body; 

    // 🚩 LOG DE SEGURIDAD PARA RENDER
    console.log(`[CHECK-IN] Intentando registrar ID: ${id} | Lat: ${lat_in} | Lng: ${lng_in}`);

    if (!lat_in || !lng_in) {
      return res.status(400).json({ message: "Coordenadas GPS incompletas" });
    }

    const route = await routeService.getRouteDetail(id, company_id);
    if (!route) return res.status(404).json({ message: "Ruta no encontrada" });

    // Validar que el local tenga coordenadas
    if (!route.local_lat || !route.local_lng) {
        return res.status(400).json({ message: "El local no tiene coordenadas registradas para validar" });
    }

    const distance = calculateDistance(
      parseFloat(lat_in), 
      parseFloat(lng_in), 
      parseFloat(route.local_lat), 
      parseFloat(route.local_lng)
    );

    const isValidGps = distance <= 250; 

    // Guardar en DB con los nombres de variables correctos
    const result = await routeService.registerCheckInWithGps({
      id,
      company_id,
      lat_in: parseFloat(lat_in),
      lng_in: parseFloat(lng_in),
      distance_meters: Math.round(distance),
      is_valid_gps: isValidGps
    });

    if (!isValidGps) {
      return res.status(400).json({ 
        isValid: false,
        message: `Fuera de rango (${Math.round(distance)}m). Acércate al local.`,
        distance: Math.round(distance)
      });
    }

    res.json({ 
      isValid: true, 
      distance: Math.round(distance), 
      message: "Check-in exitoso",
      data: result 
    });

  } catch (error) {
    console.error("❌ ERROR en checkIn Controller:", error.message);
    res.status(400).json({ message: error.message || "Error al procesar el check-in" });
  }
};

/* =========================================================
   OBTENER MIS TAREAS (Timeline del Reponedor)
========================================================= */
export const getMyTasks = async (req, res) => {
  try {
    const user_id = req.user.id;
    const company_id = req.user.company_id;
    const dateToQuery = req.query.date || new Date().toISOString().split('T')[0];

    const tasks = await routeService.getRoutesByUserAndDate(company_id, user_id, dateToQuery);
    
    const formattedTasks = (tasks || []).map(t => ({
      ...t,
      initials: `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}`.toUpperCase(),
      user_name: `${t.first_name || ''} ${t.last_name || ''}`.trim(),
    }));

    res.json(formattedTasks);
  } catch (error) {
    res.status(400).json({ message: "Error al obtener la agenda" });
  }
};

/* =========================================================
   CREAR RUTA (Individual o Recurrente)
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
      const schedule_group_id = crypto.randomUUID();
      tasksToCreate = selectedDays.map(day => ({
        company_id, user_id, local_id,
        start_time: start_time || '09:00:00',
        visit_date: null,
        day_of_week: day,
        schedule_group_id,
        is_recurring: true,
        status: 'PENDING'
      }));
    } else {
      tasksToCreate = [{
        company_id, user_id, local_id,
        start_time: start_time || '09:00:00',
        visit_date: visit_date,
        day_of_week: visit_date ? new Date(visit_date).getDay() : null,
        is_recurring: false,
        status: 'PENDING'
      }];
    }

    const result = await routeService.bulkCreateRoutes(tasksToCreate);
    res.status(201).json({ message: "Ruta(s) creada(s) con éxito", data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================================
   GESTIÓN ADMIN
========================================================= */
export const updateRoute = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    const result = await routeService.updateRoute(id, { ...req.body, company_id });
    if (!result) return res.status(404).json({ message: "Ruta no encontrada" });
    res.json({ message: "Actualización exitosa", data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

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