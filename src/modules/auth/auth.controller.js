import * as authService from "./auth.service.js"

/* =========================================
   LOGIN
========================================= */
export const login = async (req, res) => {
  try {

    console.log("AUTH CONTROLLER NUEVO ACTIVO 🚀")

    const result = await authService.loginUser(req.body)

    return res.status(200).json(result)

  } catch (error) {
    return res.status(401).json({
      message: error.message || "Error al iniciar sesión"
    })
  }
}


/* =========================================
   CHANGE PASSWORD
========================================= */
export const changePassword = async (req, res) => {
  try {

    const userId = req.user.id
    const { newPassword } = req.body

    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({
        message: "La contraseña debe tener al menos 6 caracteres"
      })
    }

    await authService.updatePassword(userId, newPassword.trim())

    return res.status(200).json({
      message: "Contraseña actualizada correctamente"
    })

  } catch (error) {
    return res.status(400).json({
      message: error.message || "Error al actualizar contraseña"
    })
  }
}