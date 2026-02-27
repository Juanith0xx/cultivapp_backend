import * as routeService from "./routes.service.js"

/* =========================================================
   CREAR RUTA
========================================================= */
export const createRoute = async (req, res) => {
  try {

    const company_id = req.user.company_id

    const route = await routeService.createRoute({
      company_id,
      user_id: req.body.user_id,
      local_id: req.body.local_id
    })

    res.status(201).json(route)

  } catch (error) {
    console.error("CREATE ROUTE ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}


/* =========================================================
   OBTENER RUTAS EMPRESA
========================================================= */
export const getRoutes = async (req, res) => {
  try {

    const company_id = req.user.company_id

    const routes = await routeService.getRoutesByCompany(company_id)

    res.json(routes)

  } catch (error) {
    console.error("GET ROUTES ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}


/* =========================================================
   OBTENER RUTAS POR USUARIO
========================================================= */
export const getRoutesByUser = async (req, res) => {
  try {

    const company_id = req.user.company_id
    const { userId } = req.params

    const routes = await routeService.getRoutesByUser(company_id, userId)

    res.json(routes)

  } catch (error) {
    console.error("GET ROUTES USER ERROR:", error)
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
    console.error("DELETE ROUTE ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}