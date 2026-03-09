import * as localeService from "./locales.services.js"

/* =========================================
   OBTENER LOCALES
========================================= */
export const getLocales = async (req, res) => {
  try {

    let companyId = req.query.company_id

    // 🔒 ADMIN_CLIENTE solo ve su empresa
    if (req.user.role === "ADMIN_CLIENTE") {
      companyId = req.user.company_id
    }

    const locales = await localeService.getLocales(companyId)

    res.json(locales)

  } catch (error) {

    console.error("GET LOCALES ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }
}

/* =========================================
   CREAR LOCAL
========================================= */
export const createLocal = async (req, res) => {
  try {

    let payload = { ...req.body }

    // 🔒 ADMIN_CLIENTE solo crea en su empresa
    if (req.user.role === "ADMIN_CLIENTE") {
      payload.company_id = req.user.company_id
    }

    const local = await localeService.createLocal(payload)

    res.status(201).json(local)

  } catch (error) {

    console.error("CREATE LOCAL ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }
}

/* =========================================
   ACTUALIZAR LOCAL
========================================= */
export const updateLocal = async (req, res) => {
  try {

    const local = await localeService.getLocalById(req.params.id)

    if (!local) {
      return res.status(404).json({
        message: "Local no encontrado"
      })
    }

    // 🔒 ADMIN_CLIENTE solo puede modificar su empresa
    if (
      req.user.role === "ADMIN_CLIENTE" &&
      local.company_id !== req.user.company_id
    ) {
      return res.status(403).json({
        message: "Sin permisos"
      })
    }

    const updated = await localeService.updateLocal(
      req.params.id,
      req.body
    )

    res.json(updated)

  } catch (error) {

    console.error("UPDATE LOCAL ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }
}

/* =========================================
   TOGGLE LOCAL
========================================= */
export const toggleLocal = async (req, res) => {
  try {

    const local = await localeService.getLocalById(req.params.id)

    if (!local) {
      return res.status(404).json({
        message: "Local no encontrado"
      })
    }

    // 🔒 ADMIN_CLIENTE solo puede modificar su empresa
    if (
      req.user.role === "ADMIN_CLIENTE" &&
      local.company_id !== req.user.company_id
    ) {
      return res.status(403).json({
        message: "Sin permisos"
      })
    }

    const updated = await localeService.toggleLocal(req.params.id)

    res.json(updated)

  } catch (error) {

    console.error("TOGGLE LOCAL ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }
}

/* =========================================
   ELIMINAR LOCAL
========================================= */
export const deleteLocal = async (req, res) => {
  try {

    const local = await localeService.getLocalById(req.params.id)

    if (!local) {
      return res.status(404).json({
        message: "Local no encontrado"
      })
    }

    if (
      req.user.role === "ADMIN_CLIENTE" &&
      local.company_id !== req.user.company_id
    ) {
      return res.status(403).json({
        message: "Sin permisos"
      })
    }

    await localeService.deleteLocal(req.params.id)

    res.json({
      message: "Local eliminado correctamente"
    })

  } catch (error) {

    console.error("DELETE LOCAL ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }
}

/* =========================================
   CARGA MASIVA EXCEL
========================================= */
export const uploadLocales = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        message: "Archivo requerido"
      })
    }

    let companyId = req.body.company_id

    // 🔒 ADMIN_CLIENTE solo puede subir a su empresa
    if (req.user.role === "ADMIN_CLIENTE") {
      companyId = req.user.company_id
    }

    const result = await localeService.uploadLocalesFromExcel(
      req.file.buffer,
      companyId
    )

    res.json({
      message: "Carga masiva completada",
      ...result
    })

  } catch (error) {

    console.error("UPLOAD LOCALES ERROR:", error)

    res.status(400).json({
      message: error.message
    })

  }
}