import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false, // Mailtrap no usa SSL directo
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
})

export const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html
    })

    console.log("📧 Email enviado correctamente a:", to)
  } catch (error) {
    console.error("❌ Error enviando email:", error)
    throw new Error("No se pudo enviar el correo")
  }
}