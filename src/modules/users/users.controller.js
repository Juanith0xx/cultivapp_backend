import * as userService from "../users/users.service.js";

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
   GET USERS (🚩 FIX ERROR 400 ROOT)
========================================= */
export const getUsers = async (req, res) => {
  try {
    const loggedUser = req.user;
    const { role: queryRole, company_id: queryCompany } = req.query;

    let users;

    if (loggedUser.role === "ROOT") {
      // ✅ Si es ROOT, queryCompany puede ser null (trae todo) o un ID específico de filtro
      users = await userService.getUsers(queryRole, queryCompany || null);
    } else {
      // 🔒 Si es ADMIN, forzamos su propia empresa
      users = await userService.getUsers(queryRole, loggedUser.company_id);
    }

    res.json(users);
  } catch (error) {
    console.error("❌ GET USERS ERROR:", error.message);
    // 🚩 Si el service lanza "Falta empresa", aquí lo capturamos para no romper el dashboard
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
   GET COMPANY STATS (🚩 FIX ROOT ACCESS)
========================================= */
export const getCompanyStats = async (req, res) => {
  try {
    const { companyId } = req.params;
    const loggedUser = req.user;

    // Permitir si es ROOT (acceso total) O si es ADMIN de esa misma empresa
    const isRoot = loggedUser.role === "ROOT";
    const isOwnerAdmin = loggedUser.role === "ADMIN_CLIENTE" && companyId === loggedUser.company_id;

    if (!isRoot && !isOwnerAdmin) {
      return res.status(403).json({ message: "Sin permisos para ver estadísticas de esta empresa" });
    }

    const stats = await userService.getCompanyStats(companyId);
    res.json(stats);
  } catch (error) { 
    console.error("❌ STATS ERROR:", error.message);
    res.status(400).json({ message: error.message }); 
  }
};