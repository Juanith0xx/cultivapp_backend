import * as authService from "./auth.service.js"

/* =========================================
   LOGIN
========================================= */
export const login = async (req, res) => {
  try {
    const result = await authService.loginUser(req.body)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(401).json({
      message: error.message || "Error al iniciar sesión"
    })
  }
}

/* =========================================
   CHANGE PASSWORD (AUTHENTICATED)
========================================= */
export const changePassword = async (req, res) => {
  try {

    const userId = req.user.id
    const { newPassword } = req.body

    await authService.updatePassword(userId, newPassword)

    return res.status(200).json({
      message: "Contraseña actualizada correctamente"
    })

  } catch (error) {
    return res.status(400).json({
      message: error.message
    })
  }
}

/* =========================================
   FORGOT PASSWORD
========================================= */
export const forgotPassword = async (req, res) => {
  try {

    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        message: "Email requerido"
      })
    }

    const result = await authService.createPasswordResetToken(email)

    if (result) {
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${result.token}`
      console.log("RESET LINK:", resetLink)
      // Aquí luego conectamos mail real
    }

    return res.status(200).json({
      message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña."
    })

  } catch (error) {
    return res.status(500).json({
      message: "Error interno"
    })
  }
}

/* =========================================
   RESET PASSWORD
========================================= */
export const resetPassword = async (req, res) => {
  try {

    const { token, newPassword } = req.body

    await authService.resetPasswordWithToken(token, newPassword)

    return res.status(200).json({
      message: "Contraseña restablecida correctamente"
    })

  } catch (error) {
    return res.status(400).json({
      message: error.message
    })
  }
}