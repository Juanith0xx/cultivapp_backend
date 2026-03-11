import * as userService from "./users.service.js"

/* =========================================
   GET PUBLIC USER CREDENTIAL
   Permite ver la credencial sin estar logueado
========================================= */
export const getPublicUserCredential = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({ message: "ID de usuario no proporcionado" })
    }

    const user = await userService.getPublicUserInfo(id)

    if (!user) {
      return res.status(404).json({ 
        message: "Credencial no válida",
        error: "El usuario no existe o ha sido eliminado."
      })
    }

    res.json(user)

  } catch (error) {
    console.error("❌ ERROR CRÍTICO EN CREDENCIAL PÚBLICA:", error.message)
    res.status(500).json({ 
      message: "Error interno al obtener la credencial",
      detail: error.message 
    })
  }
}

/* =========================================
   CREATE USER (Soporta Foto y Documento ACHS)
========================================= */
export const createUser = async (req, res) => {
  try {
    const loggedUser = req.user
    let payload = { ...req.body }

    const host = req.get('host');
    const protocol = req.protocol;

    // Manejo de múltiples archivos (req.files)
    if (req.files) {
      if (req.files.foto) {
        payload.foto_url = `${protocol}://${host}/uploads/${req.files.foto[0].filename}`;
      }
      if (req.files.documento_achs) {
        payload.achs_url = `${protocol}://${host}/uploads/achs/${req.files.documento_achs[0].filename}`;
      }
    }

    if (loggedUser.role === "ADMIN_CLIENTE") {
      payload.company_id = loggedUser.company_id

      if (payload.role === "ROOT" || payload.role === "ADMIN_CLIENTE") {
        return res.status(403).json({ message: "No permitido crear este perfil" })
      }
    }

    const user = await userService.createUser(payload)
    res.status(201).json(user)
  } catch (error) {
    console.error("CREATE USER ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   GET USERS
========================================= */
export const getUsers = async (req, res) => {
  try {
    const loggedUser = req.user
    const { role: queryRole, company_id: queryCompany } = req.query

    const users =
      loggedUser.role === "ADMIN_CLIENTE"
        ? await userService.getUsers(queryRole, loggedUser.company_id)
        : await userService.getUsers(queryRole, queryCompany)

    res.json(users)
  } catch (error) {
    console.error("GET USERS ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   UPDATE USER (Protección contra Undefined y soporte Archivos)
========================================= */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const loggedUser = req.user

    // 1. Verificamos existencia primero para evitar errores de 'undefined'
    const existingUser = await userService.getUserById(id)

    if (!existingUser) {
      return res.status(404).json({ message: "Usuario no encontrado" })
    }

    // 2. Validaciones de Seguridad
    if (existingUser.role === "ROOT") {
      return res.status(403).json({ message: "No se puede modificar usuario ROOT" })
    }

    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      existingUser.company_id !== loggedUser.company_id
    ) {
      return res.status(403).json({ message: "Sin permisos sobre este usuario" })
    }

    // 3. Procesamiento de carga de archivos
    let payload = { ...req.body }
    const host = req.get('host');
    const protocol = req.protocol;

    if (req.files) {
      if (req.files.foto) {
        payload.foto_url = `${protocol}://${host}/uploads/${req.files.foto[0].filename}`;
      }
      if (req.files.documento_achs) {
        payload.achs_url = `${protocol}://${host}/uploads/achs/${req.files.documento_achs[0].filename}`;
      }
    }

    // 4. Restricción de cambio de rol para Admin Cliente
    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      (payload.role === "ROOT" || payload.role === "ADMIN_CLIENTE")
    ) {
      delete payload.role; // Ignoramos el intento de subir de rango
    }

    const updated = await userService.updateUser(id, payload)
    res.json(updated)
  } catch (error) {
    console.error("UPDATE USER ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   TOGGLE USER
========================================= */
export const toggleUser = async (req, res) => {
  try {
    const { id } = req.params
    const loggedUser = req.user

    const user = await userService.getUserById(id)

    if (!user) return res.status(404).json({ message: "Usuario no encontrado" })
    if (user.role === "ROOT") return res.status(403).json({ message: "No permitido" })

    if (loggedUser.role === "ADMIN_CLIENTE" && user.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" })
    }

    const updated = await userService.toggleUser(id)
    res.json(updated)
  } catch (error) {
    console.error("TOGGLE USER ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   DELETE USER
========================================= */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params
    const loggedUser = req.user

    const targetUser = await userService.getUserById(id)

    if (!targetUser) return res.status(404).json({ message: "Usuario no encontrado" })
    if (targetUser.role === "ROOT") return res.status(403).json({ message: "No permitido" })

    if (loggedUser.role === "ADMIN_CLIENTE" && targetUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" })
    }

    const result = await userService.deleteUser(id)
    res.json(result)
  } catch (error) {
    console.error("DELETE USER ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   RESET PASSWORD
========================================= */
export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params
    const loggedUser = req.user

    const targetUser = await userService.getUserById(id)

    if (!targetUser) return res.status(404).json({ message: "Usuario no encontrado" })

    if (loggedUser.role === "ADMIN_CLIENTE" && targetUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" })
    }

    const result = await userService.resetPassword(id)
    res.json(result)
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   COMPANY STATS
========================================= */
export const getCompanyStats = async (req, res) => {
  try {
    const { companyId } = req.params
    const loggedUser = req.user

    if (loggedUser.role === "ADMIN_CLIENTE" && companyId !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos para esta empresa" })
    }

    const stats = await userService.getCompanyStats(companyId)
    res.json(stats)
  } catch (error) {
    console.error("STATS ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}