import * as routeService from "./routes.service.js"

/* =========================================================
   CREAR RUTA (Con Soporte para Agendamiento SaaS)
========================================================= */
export const createRoute = async (req, res) => {
  try {
    const company_id = req.user.company_id

    // Extraemos los nuevos campos que agregamos a la DB en Linux
    const { 
      user_id, 
      local_id, 
      visit_date, 
      start_time, 
      order_sequence, 
      warehouse_id 
    } = req.body

    const route = await routeService.createRoute({
      company_id,
      user_id,
      local_id,
      visit_date,      // Nuevo: Fecha de la visita
      start_time,      // Nuevo: Hora programada
      order_sequence,  // Nuevo: Orden en la ruta
      warehouse_id     // Nuevo: Bodega asignada
    })

    res.status(201).json(route)

  } catch (error) {
    console.error("❌ CREATE ROUTE ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================================
   OBTENER RUTAS EMPRESA (Dashboard de Admin)
========================================================= */
export const getRoutes = async (req, res) => {
  try {
    const company_id = req.user.company_id
    const routes = await routeService.getRoutesByCompany(company_id)
    res.json(routes)

  } catch (error) {
    console.error("❌ GET ROUTES ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================================
   OBTENER RUTAS POR USUARIO (Para el Calendario Inteligente)
========================================================= */
export const getRoutesByUser = async (req, res) => {
  try {
    const company_id = req.user.company_id
    const { userId } = req.params

    // Verificación de seguridad para evitar peticiones "undefined"
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ message: "ID de usuario requerido" })
    }

    const routes = await routeService.getRoutesByUser(company_id, userId)
    res.json(routes)

  } catch (error) {
    console.error("❌ GET ROUTES USER ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================================
   ELIMINAR RUTA
========================================================= */
export const deleteRoute = async (req, res) => {
  try {
    const company_id = req.user.company_id
    const { id } = req.params

    const result = await routeService.deleteRoute(company_id, id)
    res.json(result)

  } catch (error) {
    console.error("❌ DELETE ROUTE ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================================
   CHECK-IN (NUEVO: Para el botón "Iniciar Visita")
========================================================= */
export const checkIn = async (req, res) => {
  try {
    const company_id = req.user.company_id
    const { id } = req.params // ID de la ruta específica

    const result = await routeService.registerCheckIn(id, company_id)
    res.json({ message: "Visita iniciada correctamente", data: result })

  } catch (error) {
    console.error("❌ CHECK-IN ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}