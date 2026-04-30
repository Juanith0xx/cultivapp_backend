import * as userService from "../users/users.service.js";
import db from "../../database/db.js"; 
import xlsx from "xlsx"; // 🚩 Asegúrate de instalarlo: npm install xlsx

/* =========================================
   🚩 FIX: FUNCIÓN PARA CONVERTIR FECHA EXCEL A JS
   Excel guarda las fechas como números (serial), esta función
   los convierte al formato AAAA-MM-DD que Postgres requiere.
========================================= */
const excelDateToJS = (serial) => {
  if (!serial || isNaN(serial)) return serial; 
  // Ajuste para el desajuste de días entre Excel (1900) y JS (1970)
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0]; 
};

/* =========================================
   GET PUBLIC USER CREDENTIAL
   🚩 MEJORA: Se añade columna 'phone' a la consulta
========================================= */
export const getPublicUserCredential = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "ID no proporcionado" });

    const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.position, u.foto_url, u.rut, u.phone,
        u.fecha_inicio_contrato, u.fecha_termino_contrato, 
        u.is_active, u.achs_url, u.tipo_contrato,
        u.supervisor_nombre, u.supervisor_telefono,
        c.name as empresa_cliente
      FROM public.users u
      LEFT JOIN public.companies c ON u.company_id = c.id
      WHERE u.id = $1 AND u.deleted_at IS NULL;
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Credencial no válida o inexistente" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ ERROR CREDENCIAL PÚBLICA:", error.message);
    res.status(500).json({ message: "Error al obtener la credencial" });
  }
};

/* =========================================
   CREATE USER
   🚩 MEJORA: Soporte para campo 'phone'
========================================= */
export const createUser = async (req, res) => {
  try {
    const loggedUser = req.user;
    let payload = { ...req.body };

    if (req.files) {
      if (req.files.foto) {
        payload.foto_url = `/${req.files.foto[0].path.replace(/\\/g, "/")}`;
      }
      if (req.files.documento_achs) {
        payload.achs_url = `/${req.files.documento_achs[0].path.replace(/\\/g, "/")}`;
      }
    }

    if (loggedUser.role === "ADMIN_CLIENTE") {
      payload.company_id = loggedUser.company_id;
      if (["ROOT", "ADMIN_CLIENTE"].includes(payload.role)) {
        return res.status(403).json({ message: "No permitido crear perfiles administrativos" });
      }
    }

    // Normalizar datos para Postgres
    payload.phone = payload.phone || null;
    payload.fecha_inicio_contrato = payload.fecha_inicio_contrato || null;
    payload.fecha_termino_contrato = payload.fecha_termino_contrato || null;

    const user = await userService.createUser(payload);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   UPDATE USER
   🚩 MEJORA: Se añade 'phone' ($12) a la consulta SQL
========================================= */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedUser = req.user;

    // Verificar existencia y permisos
    const checkQuery = `SELECT id, role, company_id, foto_url, achs_url FROM users WHERE id = $1 AND deleted_at IS NULL`;
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
    const existingUser = checkResult.rows[0];

    if (existingUser.role === "ROOT") return res.status(403).json({ message: "ROOT es inmutable" });
    if (loggedUser.role === "ADMIN_CLIENTE" && existingUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    let payload = { ...req.body };

    // Procesar archivos
    let foto_final = payload.foto_url || existingUser.foto_url;
    let achs_final = payload.achs_url || existingUser.achs_url;

    if (req.files) {
      if (req.files.foto) {
        foto_final = `/${req.files.foto[0].path.replace(/\\/g, "/")}`;
      }
      if (req.files.documento_achs) {
        achs_final = `/${req.files.documento_achs[0].path.replace(/\\/g, "/")}`;
      }
    }

    // Normalización de campos
    const f_inicio = payload.fecha_inicio_contrato && payload.fecha_inicio_contrato !== "" ? payload.fecha_inicio_contrato : null;
    const f_termino = payload.fecha_termino_contrato && payload.fecha_termino_contrato !== "" ? payload.fecha_termino_contrato : null;
    const phone_val = payload.phone || null;

    const updateQuery = `
      UPDATE public.users 
      SET 
        first_name = $1, last_name = $2, email = $3, role = $4, 
        rut = $5, position = $6, tipo_contrato = $7, 
        fecha_inicio_contrato = $8, fecha_termino_contrato = $9, 
        supervisor_nombre = $10, supervisor_telefono = $11, 
        phone = $12, foto_url = $13, achs_url = $14, updated_at = NOW()
      WHERE id = $15
      RETURNING id, first_name, last_name, email, phone;
    `;

    const values = [
      payload.first_name, payload.last_name, payload.email, payload.role,
      payload.rut, payload.position, payload.tipo_contrato,
      f_inicio, f_termino,
      payload.supervisor_nombre, payload.supervisor_telefono,
      phone_val, // $12
      foto_final, // $13
      achs_final, // $14
      id // $15
    ];

    const result = await db.query(updateQuery, values);
    res.json(result.rows[0]);

  } catch (error) {
    console.error("❌ UPDATE USER ERROR:", error.message);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   GET USERS
========================================= */
export const getUsers = async (req, res) => {
  try {
    const loggedUser = req.user;
    const { role: queryRole, company_id: queryCompany } = req.query;

    let users;
    if (loggedUser.role === "ROOT") {
      users = await userService.getUsers(queryRole, queryCompany || null);
    } else {
      users = await userService.getUsers(queryRole, loggedUser.company_id);
    }

    res.json(users);
  } catch (error) {
    console.error("❌ GET USERS ERROR:", error.message);
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   TOGGLE USER
========================================= */
export const toggleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedUser = req.user;
    const user = await userService.getUserById(id);
    if (!user) return res.status(404).json({ message: "No encontrado" });
    
    if (loggedUser.role === "ADMIN_CLIENTE" && user.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" });
    }
    
    const updated = await userService.toggleUser(id);
    res.json(updated);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

/* =========================================
   DELETE USER
========================================= */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedUser = req.user;
    const targetUser = await userService.getUserById(id);
    if (!targetUser) return res.status(404).json({ message: "No encontrado" });
    
    if (loggedUser.role === "ADMIN_CLIENTE" && targetUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" });
    }
    
    const result = await userService.deleteUser(id);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

/* =========================================
   RESET PASSWORD
========================================= */
export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedUser = req.user;
    const targetUser = await userService.getUserById(id);
    if (!targetUser) return res.status(404).json({ message: "No encontrado" });
    
    if (loggedUser.role === "ADMIN_CLIENTE" && targetUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" });
    }
    
    const result = await userService.resetPassword(id);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

/* =========================================
   GET COMPANY STATS
========================================= */
export const getCompanyStats = async (req, res) => {
  try {
    const { companyId } = req.params;
    const loggedUser = req.user;

    const isRoot = loggedUser.role === "ROOT";
    const isOwnerAdmin = loggedUser.role === "ADMIN_CLIENTE" && companyId === loggedUser.company_id;

    if (!isRoot && !isOwnerAdmin) {
      return res.status(403).json({ message: "Sin permisos" });
    }

    const stats = await userService.getCompanyStats(companyId);
    res.json(stats);
  } catch (error) { 
    console.error("❌ STATS ERROR:", error.message);
    res.status(400).json({ message: error.message }); 
  }
};

/* =========================================
   NUEVA MEJORA: UPDATE USER CONTACT
========================================= */
export const updateUserContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone } = req.body;
    const loggedUser = req.user;

    const targetUser = await userService.getUserById(id);
    if (!targetUser) return res.status(404).json({ message: "Usuario no encontrado" });

    if (loggedUser.role === "ADMIN_CLIENTE" && targetUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "No tienes permisos para editar este usuario" });
    }

    const query = `
      UPDATE users 
      SET 
        email = $1, 
        phone = $2
      WHERE id = $3
      RETURNING id, first_name, email, phone;
    `;

    const result = await db.query(query, [email, phone, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Error al actualizar contacto" });
    }

    res.json({
      message: "Datos de contacto actualizados",
      user: result.rows[0]
    });
  } catch (error) {
    console.error("❌ UPDATE CONTACT ERROR:", error.message);
    if (error.code === '23505') {
        return res.status(400).json({ message: "El correo ya está siendo usado por otro usuario" });
    }
    res.status(500).json({ message: "Error interno al actualizar" });
  }
};

/* =========================================
   🚩 NUEVA MEJORA: BULK CREATE USERS (EXCEL)
   Soporte para campo 'phone' desde Excel.
========================================= */
export const bulkCreateUsers = async (req, res) => {
  try {
    const loggedUser = req.user;
    
    if (!req.files || !req.files.excel) {
      return res.status(400).json({ message: "No se ha subido ningún archivo Excel" });
    }

    const targetCompanyId = loggedUser.role === "ROOT" ? req.body.company_id : loggedUser.company_id;

    if (!targetCompanyId) {
      return res.status(400).json({ message: "ID de empresa no proporcionado para la carga" });
    }

    const file = req.files.excel[0];
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const results = { success: 0, errors: [] };

    for (const row of data) {
      try {
        const userData = {
          company_id: targetCompanyId,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone ? String(row.phone) : null, // 🚩 Mapeo de columna 'phone'
          password: String(row.password || "Cultiva.2026"),
          role: row.role?.toUpperCase() || "USUARIO",
          rut: String(row.rut || ""),
          position: row.position || "",
          tipo_contrato: row.tipo_contrato || "Plazo Fijo",
          fecha_inicio_contrato: excelDateToJS(row.fecha_inicio_contrato),
          fecha_termino_contrato: excelDateToJS(row.fecha_termino_contrato),
          supervisor_nombre: row.supervisor_nombre || "",
          supervisor_telefono: String(row.supervisor_telefono || "")
        };

        await userService.createUser(userData);
        results.success++;
      } catch (err) {
        results.errors.push({ 
          email: row.email || "Sin Email", 
          error: err.message 
        });
      }
    }

    res.json({
      message: `Proceso finalizado. ${results.success} usuarios creados.`,
      errors: results.errors
    });

  } catch (error) {
    console.error("❌ BULK CREATE ERROR:", error.message);
    res.status(500).json({ message: "Error al procesar el archivo Excel" });
  }
};