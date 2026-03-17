import * as userService from "./users.service.js"

/* =========================================
   GET PUBLIC USER CREDENTIAL
========================================= */
export const getPublicUserCredential = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ message: "ID no proporcionado" })

    const user = await userService.getPublicUserInfo(id)

    if (!user) {
      return res.status(404).json({ message: "Credencial no válida o expirada" })
    }

    res.json(user)
  } catch (error) {
    console.error("❌ ERROR CREDENCIAL PÚBLICA:", error.message)
    res.status(500).json({ message: "Error al obtener la credencial" })
  }
}

/* =========================================
   CREATE USER
========================================= */
export const createUser = async (req, res) => {
  try {
    const loggedUser = req.user
    let payload = { ...req.body }

    // Procesamiento de archivos
    if (req.files) {
      if (req.files.foto) {
        payload.foto_url = `/uploads/${req.files.foto[0].filename}`
      }
      if (req.files.documento_achs) {
        // Corregido a ACHS (mayúsculas) para coincidir con la carpeta en Linux
        payload.achs_url = `/uploads/ACHS/${req.files.documento_achs[0].filename}`
      }
    }

    if (loggedUser.role === "ADMIN_CLIENTE") {
      payload.company_id = loggedUser.company_id
      if (["ROOT", "ADMIN_CLIENTE"].includes(payload.role)) {
        return res.status(403).json({ message: "No permitido crear perfiles administrativos" })
      }
    }

    const user = await userService.createUser(payload)
    res.status(201).json(user)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   UPDATE USER
========================================= */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const loggedUser = req.user

    const existingUser = await userService.getUserById(id)
    if (!existingUser) return res.status(404).json({ message: "Usuario no encontrado" })

    // Seguridad
    if (existingUser.role === "ROOT") return res.status(403).json({ message: "ROOT es inmutable" })
    if (loggedUser.role === "ADMIN_CLIENTE" && existingUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Acceso denegado" })
    }

    let payload = { ...req.body }

    // Procesamiento de nuevos archivos
    if (req.files) {
      if (req.files.foto) {
        payload.foto_url = `/uploads/${req.files.foto[0].filename}`
      }
      if (req.files.documento_achs) {
        // IMPORTANTE: Ruta exacta para que Linux encuentre el archivo
        payload.achs_url = `/uploads/ACHS/${req.files.documento_achs[0].filename}`
      }
    }

    // Evitar escalada de privilegios
    if (loggedUser.role === "ADMIN_CLIENTE" && ["ROOT", "ADMIN_CLIENTE"].includes(payload.role)) {
      delete payload.role
    }

    const updated = await userService.updateUser(id, payload)
    res.json(updated)
  } catch (error) {
    console.error("UPDATE USER ERROR:", error)
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

    const users = loggedUser.role === "ADMIN_CLIENTE"
        ? await userService.getUsers(queryRole, loggedUser.company_id)
        : await userService.getUsers(queryRole, queryCompany)

    res.json(users)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   TOGGLE USER (Activar/Desactivar)
========================================= */
export const toggleUser = async (req, res) => {
  try {
    const { id } = req.params
    const loggedUser = req.user

    const user = await userService.getUserById(id)
    if (!user) return res.status(404).json({ message: "No encontrado" })
    if (user.role === "ROOT") return res.status(403).json({ message: "No permitido" })

    if (loggedUser.role === "ADMIN_CLIENTE" && user.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" })
    }

    const updated = await userService.toggleUser(id)
    res.json(updated)
  } catch (error) {
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

    if (!targetUser) return res.status(404).json({ message: "No encontrado" })
    if (targetUser.role === "ROOT") return res.status(403).json({ message: "No permitido" })

    if (loggedUser.role === "ADMIN_CLIENTE" && targetUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" })
    }

    const result = await userService.deleteUser(id)
    res.json(result)
  } catch (error) {
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

    if (!targetUser) return res.status(404).json({ message: "No encontrado" })
    if (loggedUser.role === "ADMIN_CLIENTE" && targetUser.company_id !== loggedUser.company_id) {
      return res.status(403).json({ message: "Sin permisos" })
    }

    const result = await userService.resetPassword(id)
    res.json(result)
  } catch (error) {
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
      return res.status(403).json({ message: "Sin permisos" })
    }

    const stats = await userService.getCompanyStats(companyId)
    res.json(stats)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}