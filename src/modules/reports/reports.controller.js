import pool from "../../database/db.js";
import path from "path";
import fs from "fs";

/**
 * 🛠️ UTILIDAD: Slugify para carpetas y nombres de archivos
 */
const slugify = (text) => {
  return text
    ?.toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/\s+/g, "_")           
    .replace(/[^a-z0-9_]/g, "")     
    || "desconocido";
};

/**
 * 🚀 1. GUARDADO FÍSICO Y LÓGICO DE FOTOS (ESTRUCTURA DINÁMICA)
 */
export const uploadVisitPhotoAction = async (req, res) => {
  try {
    const { visit_id } = req.params; 
    const { photo_type } = req.body; 
    const file = req.file;

    if (!file) return res.status(400).json({ message: "No se recibió archivo de imagen" });

    // 🚩 PASO 1: OBTENER DATA REAL DE POSTGRES
    const infoQuery = await pool.query(`
      SELECT 
        c.name as empresa_nombre,
        u.first_name,
        u.last_name,
        ur.company_id
      FROM public.user_routes ur
      INNER JOIN public.companies c ON ur.company_id = c.id
      INNER JOIN public.users u ON ur.user_id = u.id
      WHERE ur.id = $1
    `, [visit_id]);

    if (infoQuery.rows.length === 0) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ message: "La ruta asociada no existe" });
    }

    const { empresa_nombre, first_name, last_name, company_id } = infoQuery.rows[0];
    const nombreCompleto = `${first_name} ${last_name}`;

    // 🚩 PASO 2: DEFINIR ESTRUCTURA DE CARPETAS
    const folderEmpresa = slugify(empresa_nombre);
    const folderUsuario = slugify(nombreCompleto);
    
    const mapeoSubcarpetas = {
      'Fachada': 'foto_local',
      'Góndola Inicio': 'foto_gondola',
      'Góndola Final': 'foto_term_producto',
      'Observaciones': 'foto_observaciones'
    };
    const subFolder = mapeoSubcarpetas[photo_type] || 'otros';

    const relativeDirPath = path.join(folderEmpresa, folderUsuario, 'evidencias', subFolder);
    const absoluteDirPath = path.join(process.cwd(), 'uploads', relativeDirPath);

    if (!fs.existsSync(absoluteDirPath)) {
      fs.mkdirSync(absoluteDirPath, { recursive: true });
    }

    // 🚩 PASO 4: NOMBRE FINAL DEL ARCHIVO CON FECHA Y HORA (ACTUALIZADO)
    const ahora = new Date();
    // Formato: 2026-04-23
    const fecha = ahora.toISOString().split('T')[0];
    // Formato: 22h45m10s
    const hora = `${ahora.getHours()}h${ahora.getMinutes()}m${ahora.getSeconds()}s`;
    const extension = path.extname(file.originalname).toLowerCase();
    
    // Generamos un nombre tipo: Fachada_2026-04-23_22h45m10s.jpg
    const fileName = `${slugify(photo_type || 'evidencia')}_${fecha}_${hora}${extension}`;
    const finalDestination = path.join(absoluteDirPath, fileName);

    // 🚩 PASO 5: MOVER ARCHIVO
    fs.renameSync(file.path, finalDestination);

    // 🚩 PASO 6: URL PARA BASE DE DATOS
    const dbUrl = path.join(relativeDirPath, fileName).replace(/\\/g, "/");

    const result = await pool.query(
      `INSERT INTO public.visit_photos (visit_id, company_id, image_url, evidence_type, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [visit_id, company_id, dbUrl, photo_type]
    );

    res.status(201).json({ success: true, url: dbUrl, data: result.rows[0] });

  } catch (error) {
    console.error("❌ ERROR CONTROLADOR (Upload):", error.message);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Error interno al procesar imagen" });
  }
};

/**
 * 📊 2. ESTADÍSTICAS PARA EL SEMÁFORO DE COBERTURA
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { role, company_id: userCompanyId, id: currentUserId } = req.user;
    const { company_id: queryCompanyId, supervisor_id } = req.query;

    const target_supervisor = role === 'SUPERVISOR' ? currentUserId : (supervisor_id || null);
    const empresa_id = role === 'ROOT' ? queryCompanyId : userCompanyId;

    if (!empresa_id || !target_supervisor) {
      return res.json({ no_atendido: 0, atendiendo: 0, atendido: 0, sin_asignacion: 0, locales_detalle: [] });
    }

    const todayChile = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    const dowMap = [7, 1, 2, 3, 4, 5, 6]; 
    const currentDay = dowMap[new Date().getDay()];

    const query = `
      WITH my_portfolio AS (
        SELECT l.id, l.cadena, l.direccion, l.codigo_local
        FROM public.locales l
        INNER JOIN public.supervisor_locales sl ON l.id = sl.locale_id
        WHERE sl.supervisor_id = $4::uuid AND l.deleted_at IS NULL
      ),
      planned_today AS (
        SELECT ur.id as route_id, ur.local_id, ur.check_in, ur.check_out
        FROM public.user_routes ur
        WHERE ur.company_id = $1::uuid
        AND ur.local_id IN (SELECT id FROM my_portfolio)
        AND (ur.visit_date = $3::date OR (ur.visit_date IS NULL AND ur.day_of_week = $2))
        AND ur.deleted_at IS NULL
      ),
      actual_visits AS (
        SELECT v.route_id, v.started_at, v.finished_at 
        FROM public.visits v
        WHERE v.route_id IN (SELECT route_id FROM planned_today)
        AND (v.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago')::date = $3::date
      ),
      stats AS (
        SELECT 
          COUNT(DISTINCT pt.local_id) FILTER (WHERE pt.check_in IS NULL AND av.started_at IS NULL)::int as no_atendido,
          COUNT(DISTINCT pt.local_id) FILTER (WHERE (pt.check_in IS NOT NULL AND pt.check_out IS NULL) OR (av.started_at IS NOT NULL AND av.finished_at IS NULL))::int as atendiendo,
          COUNT(DISTINCT pt.local_id) FILTER (WHERE pt.check_out IS NOT NULL OR av.finished_at IS NOT NULL)::int as atendido
        FROM planned_today pt
        LEFT JOIN actual_visits av ON pt.route_id = av.route_id
      )
      SELECT 
        s.*,
        (SELECT COUNT(*)::int FROM my_portfolio WHERE id NOT IN (SELECT local_id FROM planned_today)) as sin_asignacion,
        (
          SELECT json_agg(json_build_object(
            'id', d.id,
            'cadena', d.cadena,
            'direccion', d.direccion,
            'codigo_local', d.codigo_local
          ))
          FROM (
            SELECT DISTINCT ON (mp.id) 
              mp.id, mp.cadena, mp.direccion, mp.codigo_local
            FROM my_portfolio mp
            ORDER BY mp.id
          ) d
        ) as locales_detalle
      FROM stats s;
    `;

    const result = await pool.query(query, [empresa_id, currentDay, todayChile, target_supervisor]);
    const response = result.rows[0] || { no_atendido: 0, atendiendo: 0, atendido: 0, sin_asignacion: 0, locales_detalle: [] };
    
    res.json(response);

  } catch (error) {
    console.error("❌ ERROR CONTROLADOR (Stats):", error.message);
    res.status(500).json({ message: "Error al calcular semáforo" });
  }
};

/**
 * 📸 3. AUDITORÍA FOTOGRÁFICA
 */
export const getPhotoAudit = async (req, res) => {
  try {
    const { role, company_id: userCompanyId } = req.user;
    let { empresa_id, cadena, fecha, search } = req.query;

    const isInvalid = (val) => !val || val === "[object Object]" || val === "undefined" || val === "null";

    if (role !== 'ROOT') {
      empresa_id = userCompanyId;
    } else if (isInvalid(empresa_id)) {
      return res.json([]);
    }

    let query = `
      SELECT 
        vp.id,
        vp.image_url AS photo_url,
        vp.evidence_type AS photo_type,
        vp.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago' as created_at,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        u.rut AS user_rut,
        l.cadena,
        l.direccion AS local_nombre, 
        l.codigo_local AS local_codigo,
        c.name AS empresa_nombre
      FROM public.visit_photos vp
      INNER JOIN public.user_routes ur ON vp.visit_id = ur.id
      INNER JOIN public.users u ON ur.user_id = u.id
      INNER JOIN public.locales l ON ur.local_id = l.id
      INNER JOIN public.companies c ON vp.company_id = c.id
      WHERE vp.company_id = $1
    `;

    const queryParams = [empresa_id];
    const cleanSearch = !isInvalid(search) ? search.trim() : "";

    if (cleanSearch !== "") {
      queryParams.push(`%${cleanSearch}%`);
      query += ` AND (u.first_name ILIKE $2 OR u.last_name ILIKE $2 OR u.rut ILIKE $2 OR l.direccion ILIKE $2 OR l.codigo_local ILIKE $2)`;
    } else {
      const todayChile = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
      queryParams.push(!isInvalid(fecha) ? fecha : todayChile);
      query += ` AND vp.created_at::date = $2`;
    }

    if (!isInvalid(cadena)) {
      queryParams.push(cadena);
      query += ` AND l.cadena = $${queryParams.length}`;
    }

    query += ` ORDER BY vp.created_at DESC LIMIT 150`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows || []);

  } catch (error) {
    console.error("❌ ERROR CONTROLADOR (Audit):", error.message);
    res.status(500).json({ message: "Error interno en auditoría" });
  }
};

/**
 * 📝 4. ACTUALIZAR TIPO DE EVIDENCIA
 */
export const updateVisitPhoto = async (req, res) => {
  const { id } = req.params;
  const { role, company_id: userCompanyId } = req.user;
  const { photo_type } = req.body;

  try {
    const check = await pool.query(`SELECT company_id FROM public.visit_photos WHERE id = $1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ message: "Foto no encontrada" });

    if (role !== 'ROOT' && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const result = await pool.query(`
      UPDATE public.visit_photos 
      SET evidence_type = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `, [photo_type, id]);

    res.json({ message: "Actualizado", data: result.rows[0] });
  } catch (error) {
    console.error("❌ ERROR CONTROLADOR (Update):", error.message);
    res.status(500).json({ message: "Error al actualizar evidencia" });
  }
};