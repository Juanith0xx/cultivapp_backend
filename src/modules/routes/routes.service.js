import db from "../../database/db.js";
import xlsx from "xlsx";

/* =========================================================
   CREAR RUTA (MANUAL / AGENDAMIENTO)
========================================================= */
export const createRoute = async (data) => {
  const { 
    company_id, user_id, local_id, 
    visit_date, start_time, order_sequence, warehouse_id 
  } = data;

  // 🔎 Validar usuario pertenece a empresa (Quitamos deleted_at por si no existe en la tabla users)
  const userResult = await db.query(
    `SELECT id FROM public.users WHERE id = $1 AND company_id = $2`,
    [user_id, company_id]
  );
  if (userResult.rows.length === 0) throw new Error("Usuario no pertenece a la empresa");

  // 🔎 Validar local pertenece a empresa
  const localResult = await db.query(
    `SELECT id FROM public.locales WHERE id = $1 AND company_id = $2`,
    [local_id, company_id]
  );
  if (localResult.rows.length === 0) throw new Error("Local no pertenece a la empresa");

  // 🔒 Evitar duplicados exactos
  const duplicateCheck = await db.query(
    `SELECT id FROM public.user_routes 
     WHERE user_id = $1 AND local_id = $2 AND visit_date = $3`,
    [user_id, local_id, visit_date]
  );
  if (duplicateCheck.rows.length > 0) throw new Error("Ya existe esta agenda para el usuario");

  const result = await db.query(
    `INSERT INTO public.user_routes (
      company_id, user_id, local_id, visit_date, start_time, order_sequence, warehouse_id, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW(), NOW()) RETURNING *`,
    [company_id, user_id, local_id, visit_date, start_time, order_sequence || 0, warehouse_id || null]
  );

  return result.rows[0];
};

/* =========================================================
   OBTENER RUTAS POR USUARIO (Calendario Trabajador)
   ESTA ES LA QUERY QUE USA EL CALENDARIO INTELIGENTE
========================================================= */
export const getRoutesByUser = async (company_id, user_id) => {
  const result = await db.query(
    `SELECT ur.id,
            ur.visit_date,
            ur.start_time,
            ur.status,
            ur.order_sequence,
            ur.check_in,
            l.cadena, 
            l.direccion, 
            l.lat, 
            l.lng,
            c.name as comuna_name
     FROM public.user_routes ur
     JOIN public.locales l ON ur.local_id = l.id
     LEFT JOIN public.comunas c ON l.comuna_id = c.id
     WHERE ur.company_id = $1 
       AND ur.user_id = $2
       AND (ur.deleted_at IS NULL) -- Solo si ejecutaste el ALTER TABLE
     ORDER BY ur.visit_date ASC, ur.order_sequence ASC`,
    [company_id, user_id]
  );
  return result.rows;
};

/* =========================================================
   REGISTRAR CHECK-IN
========================================================= */
export const registerCheckIn = async (route_id, company_id) => {
  const result = await db.query(
    `UPDATE public.user_routes 
     SET 
       check_in = NOW(), 
       status = 'IN_PROGRESS',
       updated_at = NOW()
     WHERE id = $1 AND company_id = $2 AND status = 'PENDING'
     RETURNING *`,
    [route_id, company_id]
  );

  if (result.rows.length === 0) {
    throw new Error("No se pudo iniciar la visita. Verifique el estado.");
  }
  return result.rows[0];
};

/* =========================================================
   OBTENER RUTAS POR EMPRESA (Admin Dashboard)
========================================================= */
export const getRoutesByCompany = async (company_id) => {
  const result = await db.query(
    `SELECT ur.*,
            u.first_name, u.last_name, u.rut as user_rut,
            l.cadena, l.direccion,
            c.name as comuna_name
     FROM public.user_routes ur
     JOIN public.users u ON ur.user_id = u.id
     JOIN public.locales l ON ur.local_id = l.id
     LEFT JOIN public.comunas c ON l.comuna_id = c.id
     WHERE ur.company_id = $1
     ORDER BY ur.visit_date DESC, ur.start_time ASC`,
    [company_id]
  );
  return result.rows;
};

/* =========================================================
   CARGA MAESTRA EXCEL
========================================================= */
export const processMasterExcel = async (fileBuffer, company_id) => {
  const workbook = xlsx.read(fileBuffer, { type: "buffer" });
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  const client = await db.connect();
  const summary = { inserted: 0, errors: [] };

  try {
    await client.query("BEGIN");
    for (const [index, row] of rows.entries()) {
      const { rut_trabajador, id_local, fecha, hora, orden } = row;

      const userRes = await client.query(
        "SELECT id FROM public.users WHERE rut = $1 AND company_id = $2",
        [String(rut_trabajador).trim(), company_id]
      );

      if (userRes.rows.length === 0) {
        summary.errors.push({ fila: index + 2, motivo: `RUT ${rut_trabajador} no encontrado` });
        continue;
      }

      await client.query(
        `INSERT INTO public.user_routes 
         (company_id, user_id, local_id, visit_date, start_time, order_sequence, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW(), NOW())`,
        [company_id, userRes.rows[0].id, id_local, fecha, hora, orden || 0]
      );
      summary.inserted++;
    }
    await client.query("COMMIT");
    return summary;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/* =========================================================
   ELIMINAR RUTA (Borrado Físico por ahora para evitar errores)
========================================================= */
export const deleteRoute = async (company_id, route_id) => {
  const result = await db.query(
    `DELETE FROM public.user_routes WHERE id = $1 AND company_id = $2 RETURNING id`,
    [route_id, company_id]
  );

  if (result.rows.length === 0) throw new Error("Ruta no encontrada");
  return { message: "Ruta eliminada correctamente" };
};