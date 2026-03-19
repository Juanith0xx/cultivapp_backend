import * as routeService from "./routes.service.js";
import crypto from "crypto";

/* =========================================================
   CREAR RUTAS (Soporte Manual y Masivo por Excel)
========================================================= */
export const createRoute = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { tasks } = req.body;

    const tasksArray = Array.isArray(tasks) ? tasks : [req.body];

    if (tasksArray.length === 0) {
      return res.status(400).json({ message: "No se proporcionaron tareas para agendar" });
    }

    const formattedTasks = tasksArray.map(task => ({
      company_id,
      user_id: task.user_id,
      local_id: task.local_id,
      visit_date: task.visit_date || null,
      start_time: task.start_time || '09:00:00',
      order_sequence: task.order_sequence || 1,
      warehouse_id: task.warehouse_id || null,
      day_of_week: task.day_of_week || null,
      schedule_group_id: task.schedule_group_id || null,
      is_recurring: task.is_recurring || false,
      status: 'PENDING'
    }));

    const result = await routeService.bulkCreateRoutes(formattedTasks);
    
    res.status(201).json({
      message: "Agenda procesada exitosamente",
      count: result.length,
      data: result
    });

  } catch (error) {
    console.error("❌ CREATE ROUTE ERROR:", error);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================================
   CREAR RUTAS MASIVAS (Días de la Semana)
========================================================= */
export const createBulk = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { user_id, local_id, start_time, selectedDays } = req.body;

    if (!selectedDays || selectedDays.length === 0) {
      return res.status(400).json({ message: "Debes seleccionar al menos un día" });
    }

    const schedule_group_id = crypto.randomUUID();

    const formattedTasks = selectedDays.map(day => ({
      company_id,
      user_id,
      local_id,
      visit_date: null,
      start_time: start_time || '09:00:00',
      day_of_week: day,
      schedule_group_id,
      is_recurring: true,
      status: 'PENDING'
    }));

    const result = await routeService.bulkCreateRoutes(formattedTasks);
    
    res.status(201).json({
      message: `${result.length} rutas agendadas correctamente`,
      data: result
    });

  } catch (error) {
    console.error("❌ CREATE BULK ERROR:", error);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================================
   ACTUALIZAR RUTA (Edición)
   Modificado para soportar edición de múltiples días
========================================================= */
export const updateRoute = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    const { user_id, local_id, start_time, selectedDays, visit_date } = req.body;

    // Aseguramos que selectedDays sea un array para evitar errores en el service
    const safeSelectedDays = Array.isArray(selectedDays) ? selectedDays : [];

    const updateData = {
      user_id,
      local_id,
      start_time,
      selectedDays: safeSelectedDays, // Enviamos el array completo
      visit_date,
      company_id
    };

    const result = await routeService.updateRoute(id, updateData);
    
    if (!result) {
      return res.status(404).json({ message: "No se encontró la ruta para actualizar" });
    }

    res.json({
      message: "Planificación actualizada exitosamente",
      data: result
    });

  } catch (error) {
    console.error("❌ UPDATE ROUTE ERROR:", error);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================================
   CHECK-IN CON GPS (Para el reponedor)
========================================================= */
export const checkIn = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: "Coordenadas GPS requeridas" });
    }

    const route = await routeService.getRouteDetail(id, company_id);
    if (!route) return res.status(404).json({ message: "Ruta no encontrada" });

    const distance = calculateDistance(lat, lng, route.local_lat, route.local_lng);
    const isValidGps = distance <= 250; 

    const result = await routeService.registerCheckInWithGps({
      id,
      company_id,
      lat_in: lat,
      lng_in: lng,
      distance_meters: Math.round(distance),
      is_valid_gps: isValidGps
    });

    res.json({ 
      message: isValidGps ? "Check-in exitoso" : "Check-in fuera de rango", 
      isValid: isValidGps,
      distance: Math.round(distance),
      data: result 
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   AUXILIAR: Cálculo de Distancia
========================================= */
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
   OBTENER RUTAS
========================================================= */
export const getRoutes = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const routes = await routeService.getRoutesByCompany(company_id);
    res.json(routes);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getRoutesByUser = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { userId } = req.params;
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ message: "ID de usuario requerido" });
    }
    const routes = await routeService.getRoutesByUser(company_id, userId);
    res.json(routes);
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