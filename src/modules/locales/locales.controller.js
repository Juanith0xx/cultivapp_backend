import * as localeService from "./locales.services.js"

/* =========================================
   OBTENER LOCALES
========================================= */
export const getLocales = async (req, res) => {
  try {
    const { company_id } = req.query
    const locales = await localeService.getLocales(company_id)
    res.json(locales)
  } catch (error) {
    console.error("GET LOCALES ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   CREAR LOCAL
========================================= */
export const createLocal = async (req, res) => {
  try {
    const local = await localeService.createLocal(req.body)
    res.status(201).json(local)
  } catch (error) {
    console.error("CREATE LOCAL ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   TOGGLE LOCAL
========================================= */
export const toggleLocal = async (req, res) => {
  try {
    const local = await localeService.toggleLocal(req.params.id)
    res.json(local)
  } catch (error) {
    console.error("TOGGLE LOCAL ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   ELIMINAR LOCAL
========================================= */
export const deleteLocal = async (req, res) => {
  try {
    await localeService.deleteLocal(req.params.id)
    res.json({ message: "Local eliminado correctamente" })
  } catch (error) {
    console.error("DELETE LOCAL ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}

/* =========================================
   CARGA MASIVA EXCEL
========================================= */
export const uploadLocales = async (req, res) => {
  try {

    const { company_id } = req.body

    if (!req.file) {
      return res.status(400).json({ message: "Archivo requerido" })
    }

    const result = await localeService.uploadLocalesFromExcel(
      req.file.buffer,
      company_id
    )

    res.json({
      message: "Carga masiva completada",
      ...result
    })

  } catch (error) {
    console.error("UPLOAD LOCALES ERROR:", error)
    res.status(400).json({ message: error.message })
  }
}