import * as authService from "./auth.service.js"
import { sendEmail } from "../../utils/mailer.js"

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
      message: error.message
    })
  }
}

/* =========================================
   FORGOT PASSWORD (ENVÍO REAL)
========================================= */
export const forgotPassword = async (req, res) => {
  try {

    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        message: "Email requerido"
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const result = await authService.createPasswordResetToken(normalizedEmail)

    // ⚠️ Nunca revelar si el email existe o no
    if (result) {

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${result.token}`

      await sendEmail({
        to: normalizedEmail,
        subject: "Recuperación de contraseña - Cultivapp",
        html: `
          <div style="font-family: Arial; padding:20px;">
            <h2>Recuperación de contraseña</h2>
            <p>Haz clic en el botón para restablecer tu contraseña:</p>

            <a href="${resetLink}" 
               style="display:inline-block;
                      padding:12px 20px;
                      background:#87be00;
                      color:white;
                      text-decoration:none;
                      border-radius:6px;">
              Restablecer contraseña
            </a>

            <p style="margin-top:15px;">
              Este enlace expira en 15 minutos.
            </p>
          </div>
        `
      })

      console.log("📩 Email de recuperación enviado a:", normalizedEmail)
    }

    return res.status(200).json({
      message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña."
    })

  } catch (error) {
    console.error("ERROR FORGOT PASSWORD:", error)

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

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Datos inválidos"
      })
    }

    await authService.resetPasswordWithToken(token, newPassword.trim())

    return res.status(200).json({
      message: "Contraseña restablecida correctamente"
    })

  } catch (error) {
    return res.status(400).json({
      message: error.message
    })
  }
}

/* =========================================
   TEST EMAIL (TEMPORAL)
========================================= */
export const testEmail = async (req, res) => {
  try {

    await sendEmail({
      to: "test@test.com",
      subject: "Prueba Cultivapp 🚀",
      html: `
        <div style="font-family: Arial; padding:20px;">
          <h2>Email funcionando correctamente</h2>
          <p>Tu sistema SMTP está configurado correctamente.</p>
        </div>
      `
    })

    console.log("📧 Email enviado correctamente a: test@test.com")

    return res.status(200).json({
      message: "Email enviado correctamente"
    })

  } catch (error) {
    console.error("ERROR EMAIL:", error)

    return res.status(500).json({
      message: "Error enviando email",
      error: error.message
    })
  }
}