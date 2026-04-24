import * as routeService from "./routes.service.js";
import crypto from "crypto";
import db from "../../database/db.js"; 

/**
 * 🛠️ UTILIDAD: Limpiar RUT (Normalización)
 */
const cleanRutStr = (val) => {
  if (!val) return "";
  return String(val).replace(/[^0-9kK]/g, "").toUpperCase().trim();
};

/**
 * 🛠️ UTILIDAD: Validar y formatear HORA (HH:mm)
 */
const validateTime = (timeStr) => {
  if (!timeStr) return "08:00";
  try {
    if (timeStr instanceof Date) return timeStr.toTimeString().substring(0, 5);
    const match = String(timeStr).trim().match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}` : "08:00";
  } catch (e) { return "08:00"; }
};

/**
 * 🛠️ UTILIDAD: Validar y formatear FECHA (YYYY-MM-DD)
 */
const validateDate = (dateVal) => {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  } catch (e) { return null; }
};

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
   1. CARGA MASIVA (Lógica SaaS Inteligente - Blindada)
========================================================= */

export const bulkCreate = async (req, res) => {
  const company_id = req.user.company_id;
  console.log(`🚀 SaaS Bulk: Petición recibida para Empresa ${company_id}`);
  
  try {
    /**
     * 🚩 ESTRATEGIA DE RESCATE MULTI-ORIGEN
     * Capturamos los datos si vienen como JSON, FormData o String.
     */
    let rawData = null;

    if (Array.isArray(req.body)) {
      rawData = req.body;
    } else if (req.body && req.body.routes) {
      // Si routes viene como string (común en FormData), lo parseamos
      rawData = typeof req.body.routes === 'string' 
        ? JSON.parse(req.body.routes) 
        : req.body.routes;
    } else if (req.body && req.body.data) {
      rawData = typeof req.body.data === 'string' 
        ? JSON.parse(req.body.data) 
        : req.body.data;
    }

    // LOG DE CONTROL PARA TERMINAL
    console.log("------------------------------------------");
    console.log("📦 Body Type:", typeof req.body);
    console.log("📦 ¿Data encontrada?:", !!rawData ? `SÍ (${rawData.length} filas)` : "NO");
    console.log("------------------------------------------");

    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No se encontraron datos válidos. El servidor recibió un cuerpo vacío o mal formateado." 
      });
    }

    const processedRoutes = [];
    const errors = [];

    for (let i = 0; i < rawData.length; i++) {
      const fila = rawData[i];
      const keys = Object.keys(fila);

      // Mapeo dinámico de turnos (Turno semana 1, 2, etc.)
      const turnosSemana = keys
        .filter(k => /turno/i.test(k) && /semana/i.test(k))
        .map(k => fila[k])
        .filter(t => t && String(t).trim() !== "" && String(t).toUpperCase() !== "NULL");

      // Normalización basada en nombres comunes del Excel
      const rutExcel = cleanRutStr(fila.Rut_Mercaderista || fila.rut || fila.RUT || fila["Rut 2"]);
      const codigoLocal = String(fila.Codigo || fila.codigo || fila.center_code || "").trim();

      if (!rutExcel || !codigoLocal || turnosSemana.length === 0) continue;

      // Cruce con Base de Datos (Aislamiento por Company)
      const [userRes, localRes] = await Promise.all([
        db.query("SELECT id FROM public.users WHERE rut = $1 AND company_id = $2 LIMIT 1", [rutExcel, company_id]),
        db.query("SELECT id FROM public.locales WHERE codigo_local = $1 AND company_id = $2 LIMIT 1", [codigoLocal, company_id])
      ]);

      if (userRes.rows.length === 0 || localRes.rows.length === 0) {
        errors.push(`Fila ${i + 1}: RUT ${rutExcel} o Local ${codigoLocal} no existen.`);
        continue;
      }

      const userId = userRes.rows[0].id;
      const localId = localRes.rows[0].id;
      const schedule_group_id = crypto.randomUUID();
      const turnosUnicos = [...new Set(turnosSemana)];

      for (const nombreTurno of turnosUnicos) {
        // Búsqueda flexible de turnos configurados
        const turnosRes = await db.query(
          `SELECT day_of_week, entrada FROM public.turnos_config 
           WHERE company_id = $1 
           AND UPPER(REPLACE(nombre_turno, ' ', '')) = UPPER(REPLACE($2, ' ', '')) 
           AND is_active = true`,
          [company_id, String(nombreTurno).trim()]
        );

        if (turnosRes.rows.length === 0) {
          errors.push(`Fila ${i + 1}: El turno '${nombreTurno}' no está configurado.`);
          continue;
        }

        turnosRes.rows.forEach(t => {
          processedRoutes.push({
            company_id,
            user_id: userId,
            local_id: localId,
            start_time: t.entrada,
            day_of_week: parseInt(t.day_of_week, 10),
            schedule_group_id,
            is_recurring: true,
            origin: 'TURNO',
            visit_date: null
          });
        });
      }
    }

    if (processedRoutes.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No se pudieron procesar rutas. Verifique RUTs y Nombres de Turnos.", 
        errors 
      });
    }

    const result = await routeService.bulkCreateRoutes(processedRoutes);
    
    res.status(201).json({ 
      success: true, 
      count: result?.length || 0, 
      errors: errors.length > 0 ? errors : null 
    });

  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN BULKCREATE:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
};

/* =========================================================
   2. OPERACIONES INDIVIDUALES Y MONITOREO
========================================================= */

export const createRoute = async (req, res) => {
  try {
    const { user_id, local_id, start_time, visit_date, selectedDays, is_recurring } = req.body;
    const company_id = req.user.role === 'ROOT' ? (req.body.company_id || req.user.company_id) : req.user.company_id;
    
    let tasks;
    if (is_recurring && selectedDays?.length > 0) {
      const groupId = crypto.randomUUID();
      tasks = selectedDays.map(day => ({ 
        company_id, user_id, local_id, start_time: validateTime(start_time), 
        day_of_week: parseInt(day), 
        schedule_group_id: groupId, is_recurring: true, origin: 'TURNO' 
      }));
    } else {
      const vDate = validateDate(visit_date);
      tasks = [{ 
        company_id, user_id, local_id, start_time: validateTime(start_time), 
        visit_date: vDate, 
        day_of_week: vDate ? new Date(vDate + "T12:00:00").getDay() : null,
        is_recurring: false, origin: 'INDIVIDUAL' 
      }];
    }

    const result = await routeService.bulkCreateRoutes(tasks);
    res.status(201).json({ data: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const checkIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat_in, lng_in } = req.body;
    const { company_id, role } = req.user;
    const targetCompanyId = role === 'ROOT' ? (req.body.company_id || company_id) : company_id;

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
      SET status = 'IN_PROGRESS', check_in = CURRENT_TIMESTAMP, lat_in = $1, lng_in = $2, 
          distance_meters = $3, is_valid_gps = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 ${role !== 'ROOT' ? 'AND company_id = $6' : ''}
      RETURNING *;
    `, [parseFloat(lat_in), parseFloat(lng_in), Math.round(distance), isValidGps, id, ... (role !== 'ROOT' ? [targetCompanyId] : [])]);
    
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

export const getMyTasks = (req, res) => {
  const date = validateDate(req.query.date) || new Date().toISOString().split('T')[0];
  routeService.getRoutesByUserAndDate(
    req.user.role === 'ROOT' ? null : req.user.company_id, 
    (req.user.role === 'ROOT' && req.query.userId) ? req.query.userId : req.user.id, 
    date
  ).then(tasks => res.json(tasks || [])).catch(err => res.status(400).json({ message: err.message }));
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
      FROM public.user_routes r 
      JOIN public.users u ON r.user_id = u.id 
      JOIN public.locales l ON r.local_id = l.id 
      WHERE r.company_id = $1 AND r.deleted_at IS NULL
    `;
    const params = [targetCompanyId];

    if (search?.trim().length > 2) {
      query += ` AND (u.first_name ILIKE $2 OR u.last_name ILIKE $2 OR l.cadena ILIKE $2 OR l.codigo_local ILIKE $2)`;
      params.push(`%${search}%`);
    } else {
      const reportDate = validateDate(date) || new Date().toISOString().split('T')[0];
      query += ` AND (DATE(r.check_in) = $2 OR r.visit_date = $2 OR (r.is_recurring = true AND r.day_of_week = EXTRACT(DOW FROM $2::date)))`;
      params.push(reportDate);
    }
    const result = await db.query(query + " ORDER BY r.visit_date DESC", params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error al generar reporte" });
  }
};

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

/* =========================================================
   3. MANTENIMIENTO
========================================================= */

export const getRoutesByUser = (req, res) => routeService.getRoutesByUser(req.user.role === 'ROOT' ? null : req.user.company_id, req.params.userId).then(r => res.json(r));
export const getRoutes = (req, res) => routeService.getRoutesByCompany(req.user.role === 'ROOT' ? req.query.company_id : req.user.company_id).then(r => res.json(r));
export const updateRoute = (req, res) => routeService.updateRoute(req.params.id, req.body).then(r => res.json(r));
export const deleteRoute = (req, res) => routeService.deleteRoute(req.user.company_id, req.params.id).then(r => res.json(r));
export const resetCheckIn = (req, res) => routeService.resetRouteStatus(req.params.id, req.user.company_id).then(r => res.json(r));

export const addVisitScan = async (req, res) => {
  try {
    const result = await db.query(`INSERT INTO public.visit_scans (visit_id, company_id, barcode) VALUES ($1, $2, $3) RETURNING *;`, [req.params.id, req.user.company_id, req.body.barcode]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
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