import pkg from "pg"
const { Pool } = pkg

// 🔍 DEBUG VARIABLES DE ENTORNO
console.log("----- DEBUG ENV VARIABLES -----")
console.log("DB_HOST:", process.env.DB_HOST)
console.log("DB_USER:", process.env.DB_USER)
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "✔️ Existe" : "❌ Undefined")
console.log("DB_NAME:", process.env.DB_NAME)
console.log("DB_PORT:", process.env.DB_PORT)
console.log("--------------------------------")

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
})

pool.on("connect", () => {
  console.log("✅ Conectado a PostgreSQL")
})

pool.on("error", (err) => {
  console.error("❌ Error en PostgreSQL", err)
  process.exit(1)
})

export default pool