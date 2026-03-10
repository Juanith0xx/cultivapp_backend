import * as comunaService from "./comunas.services.js"

export const getComunas = async (req, res) => {

  try {

    const { region_id } = req.query

    if (!region_id) {
      return res.status(400).json({
        message: "region_id requerido"
      })
    }

    const comunas = await comunaService.getComunas(region_id)

    res.json(comunas)

  } catch (error) {

    console.error("GET COMUNAS ERROR:", error)

    res.status(500).json({
      message: "Error obteniendo comunas"
    })

  }

}