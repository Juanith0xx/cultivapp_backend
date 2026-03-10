import * as regionService from "./regions.services.js"

export const getRegions = async (req, res) => {

  try {

    const regions = await regionService.getRegions()

    res.json(regions)

  } catch (error) {

    console.error("GET REGIONS ERROR:", error)

    res.status(500).json({
      message: "Error obteniendo regiones"
    })

  }

}