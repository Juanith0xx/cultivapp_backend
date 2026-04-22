import * as userService from "../users/users.service.js";
import db from "../../database/db.js"; // 🚩 Asegúrate de que esta importación sea correcta según tu estructura

/* =========================================
   GET PUBLIC USER CREDENTIAL
========================================= */
export const getPublicUserCredential = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "ID no proporcionado" });

    const user = await userService.getPublicUserInfo(id);

    if (!user) {
      return res.status(404).json({ message: "Credencial no válida o expirada" });
    }

    res.json(user);
  } catch (error) {
    console.error("❌ ERROR CREDENCIAL PÚBLICA:", error.message);
    res.status(500).json({ message: "Error al obtener la credencial" });
  }
};

/* =========================================
   CREATE USER
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

    const user = await userService.createUser(payload);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/* =========================================
   UPDATE USER
========================================= */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedUser = req.user;

    const existingUser = await userService.getUserById(id);
    if (!existingUser) return res.status(404).json({ message: "Usuario no encontrado" });

    if (existingUser.role === "ROOT") return res.status(403).json({ message: "ROOT es inmutable" });
    
    if (loggedUser.role === "ADMIN_CLIENTE" && existingUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    let payload = { ...req.body };

    if (req.files) {
      if (req.files.foto) {
        payload.foto_url = `/${req.files.foto[0].path.replace(/\\/g, "/")}`;
      }
      if (req.files.documento_achs) {
        payload.achs_url = `/${req.files.documento_achs[0].path.replace(/\\/g, "/")}`;
      }
    }

    if (loggedUser.role === "ADMIN_CLIENTE" && ["ROOT", "ADMIN_CLIENTE"].includes(payload.role)) {
      delete payload.role;
    }

    const updated = await userService.updateUser(id, payload);
    res.json(updated);
  } catch (error) {
    console.error("❌ UPDATE USER ERROR:", error);
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
   (Consulta Directa a DB para evitar fallos de servicio)
   ========================================= */
export const updateUserContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone } = req.body;
    const loggedUser = req.user;

    // 1. Verificación de permisos básica
    const targetUser = await userService.getUserById(id);
    if (!targetUser) return res.status(404).json({ message: "Usuario no encontrado" });

    if (loggedUser.role === "ADMIN_CLIENTE" && targetUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "No tienes permisos para editar este usuario" });
    }

    // 2. Consulta Directa
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
    
    // Error de email duplicado en Postgres
    if (error.code === '23505') {
        return res.status(400).json({ message: "El correo ya está siendo usado por otro usuario" });
    }
    
    res.status(500).json({ message: "Error interno al actualizar" });
  }
};