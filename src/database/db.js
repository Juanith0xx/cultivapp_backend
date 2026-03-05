import pkg from "pg"
const { Pool } = pkg

let pool

// 🌐 PRODUCCIÓN (Render)
if (process.env.DATABASE_URL) {

  console.log("🌍 Conectando a PostgreSQL en producción")

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  })

} else {

  // 💻 DESARROLLO LOCAL
  console.log("💻 Conectando a PostgreSQL local")

  pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  })

}

pool.on("connect", () => {
  console.log("✅ Conectado a PostgreSQL")
})

pool.on("error", (err) => {
  console.error("❌ Error en PostgreSQL", err)
  process.exit(1)
})

export default pool