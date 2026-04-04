import dns from 'node:dns';
// Esta línea es la clave: obliga a Node.js a preferir IPv4 sobre IPv6
dns.setDefaultResultOrder('ipv4first');

import "./src/config/env.js"
import app from "./src/app.js"
import pool from "./src/database/db.js"

const PORT = process.env.PORT || 4000

const startServer = async () => {
  try {
    // Verificamos conexión
    await pool.query("SELECT 1")
    console.log("✅ Conexión a base de datos exitosa")

    // Escuchamos en '0.0.0.0' para asegurar que Railway pueda rutear el tráfico
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
    })

  } catch (error) {
    console.error("❌ Error iniciando servidor:", error)
    process.exit(1)
  }
}

startServer()