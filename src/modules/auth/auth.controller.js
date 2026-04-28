import * as authService from "./auth.service.js"
import { sendEmail } from "../../utils/mailer.js"

/* =========================================
   LOGIN
========================================= */
export const login = async (req, res) => {
  try {
    const result = await authService.loginUser(req.body)
    
    // 🚩 DEBUG MEJORADO: Verificamos si el service está trayendo el nombre y apellido
    console.log("🔑 LOGIN EXITOSO:", {
      user: result.user.email,
      company_id: result.user.company_id, 
      role: result.user.role,
      first_name: result.user.first_name, // Si dice undefined, el error está en el Service
      last_name: result.user.last_name    // Si dice undefined, el error está en el Service
    });

    return res.status(200).json(result)
  } catch (error) {
    console.error("❌ ERROR LOGIN:", error.message);
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
   FORGOT PASSWORD
========================================= */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: "Email requerido" })

    const normalizedEmail = email.trim().toLowerCase()
    const result = await authService.createPasswordResetToken(normalizedEmail)

    if (result) {
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${result.token}`

      await sendEmail({
        to: normalizedEmail,
        subject: "Recuperación de contraseña - Cultivapp",
        html: `
          <div style="font-family: Arial; padding:20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">Recuperación de contraseña</h2>
            <p>Has solicitado restablecer tu acceso a Cultivapp. Haz clic en el botón:</p>

            <a href="${resetLink}" 
               style="display:inline-block;
                      padding:12px 24px;
                      background:#87be00;
                      color:white;
                      text-decoration:none;
                      font-weight: bold;
                      border-radius:8px;
                      margin: 10px 0;">
              Restablecer contraseña
            </a>

            <p style="font-size: 12px; color: #666; margin-top:15px;">
              Este enlace expirará en 15 minutos por tu seguridad.
            </p>
          </div>
        `
      })
      console.log("📩 Email enviado a:", normalizedEmail)
    }

    return res.status(200).json({
      message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña."
    })

  } catch (error) {
    console.error("ERROR FORGOT PASSWORD:", error)
    return res.status(500).json({ message: "Error interno" })
  }
}

/* =========================================
   RESET PASSWORD
========================================= */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Datos inválidos" })
    }

    await authService.resetPasswordWithToken(token, newPassword.trim())

    return res.status(200).json({ message: "Contraseña restablecida correctamente" })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
}