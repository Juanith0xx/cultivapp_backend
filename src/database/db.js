import pkg from "pg"
const { Pool } = pkg

let pool

if (process.env.DATABASE_URL) {
  console.log("🌍 Conectando a PostgreSQL en producción (IPv4 Pooler)")

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    // Añadimos esto para mayor estabilidad en Railway
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
} else {
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
  // No salgas del proceso inmediatamente en producción para que Railway no cicle
  if (process.env.DATABASE_URL) {
     console.log("Reintentando conexión...")
  } else {
     process.exit(1)
  }
})

export default pool