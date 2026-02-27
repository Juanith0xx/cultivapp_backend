import "./src/config/env.js"

import app from "./src/app.js"
import pool from "./src/database/db.js"

const PORT = process.env.PORT || 4000

const startServer = async () => {
  try {
    await pool.query("SELECT 1")

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
    })

  } catch (error) {
    console.error("❌ Error iniciando servidor:", error)
    process.exit(1)
  }
}

startServer()