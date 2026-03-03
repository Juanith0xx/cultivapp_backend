import * as userService from "./users.service.js"

/* =========================================
   CREATE USER
========================================= */
export const createUser = async (req, res) => {
  try {

    const loggedUser = req.user
    let payload = { ...req.body }

    // 🔒 ADMIN_CLIENTE solo crea en su empresa
    if (loggedUser.role === "ADMIN_CLIENTE") {

      payload.company_id = loggedUser.company_id

      if (
        payload.role === "ROOT" ||
        payload.role === "ADMIN_CLIENTE"
      ) {
        return res.status(403).json({
          message: "No permitido crear este perfil"
        })
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
   UPDATE USER
========================================= */
export const updateUser = async (req, res) => {
  try {

    const { id } = req.params
    const loggedUser = req.user

    const existingUser = await userService.getUserById(id)

    if (!existingUser) {
      return res.status(404).json({ message: "Usuario no encontrado" })
    }

    // 🚫 Nunca editar ROOT
    if (existingUser.role === "ROOT") {
      return res.status(403).json({
        message: "No se puede modificar usuario ROOT"
      })
    }

    // 🔒 Multi-tenant
    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      existingUser.company_id !== loggedUser.company_id
    ) {
      return res.status(403).json({
        message: "Sin permisos sobre este usuario"
      })
    }

    // 🚫 ADMIN_CLIENTE no puede escalar privilegios
    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      (req.body.role === "ROOT" ||
        req.body.role === "ADMIN_CLIENTE")
    ) {
      return res.status(403).json({
        message: "No puedes asignar ese perfil"
      })
    }

    const updated = await userService.updateUser(id, req.body)
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

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" })
    }

    if (user.role === "ROOT") {
      return res.status(403).json({
        message: "No se puede modificar usuario ROOT"
      })
    }

    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      user.company_id !== loggedUser.company_id
    ) {
      return res.status(403).json({
        message: "Sin permisos"
      })
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

    if (!targetUser) {
      return res.status(404).json({ message: "Usuario no encontrado" })
    }

    // 🚫 Nunca eliminar ROOT
    if (targetUser.role === "ROOT") {
      return res.status(403).json({
        message: "No permitido eliminar usuario ROOT"
      })
    }

    // 🚫 ADMIN_CLIENTE no puede eliminar otro ADMIN_CLIENTE
    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      targetUser.role === "ADMIN_CLIENTE"
    ) {
      return res.status(403).json({
        message: "No puedes eliminar otro administrador"
      })
    }

    // 🚫 No puede eliminarse a sí mismo
    if (loggedUser.id === targetUser.id) {
      return res.status(403).json({
        message: "No puedes eliminar tu propia cuenta"
      })
    }

    // 🔒 Multi-tenant
    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      targetUser.company_id !== loggedUser.company_id
    ) {
      return res.status(403).json({
        message: "No tienes permisos sobre este usuario"
      })
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

    if (!targetUser) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      })
    }

    // 🚫 Nunca resetear ROOT
    if (targetUser.role === "ROOT") {
      return res.status(403).json({
        message: "No permitido resetear usuario ROOT"
      })
    }

    // 🔒 Multi-tenant
    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      targetUser.company_id !== loggedUser.company_id
    ) {
      return res.status(403).json({
        message: "No tienes permisos sobre este usuario"
      })
    }

    const result = await userService.resetPassword(id, loggedUser)
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

    if (
      loggedUser.role === "ADMIN_CLIENTE" &&
      companyId !== loggedUser.company_id
    ) {
      return res.status(403).json({
        message: "Sin permisos para esta empresa"
      })
    }

    const stats = await userService.getCompanyStats(companyId)
    res.json(stats)

  } catch (error) {
    console.error("STATS ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}