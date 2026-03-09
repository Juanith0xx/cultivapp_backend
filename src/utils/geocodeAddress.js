const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN

if (!MAPBOX_TOKEN) {
  console.warn("⚠️ MAPBOX_TOKEN no está definido en variables de entorno")
}

/* =========================================
   GEOCODE ADDRESS (MAPBOX)
========================================= */

const geocodeAddress = async (address) => {

  try {

    if (!address || typeof address !== "string") {
      return null
    }

    const cleanAddress = address.trim()

    if (!cleanAddress) {
      return null
    }

    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleanAddress)}.json` +
      `?access_token=${MAPBOX_TOKEN}&country=CL&limit=1`

    /* Timeout protección */

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error("❌ Mapbox API error:", response.status)
      return null
    }

    const data = await response.json()

    if (!data.features || data.features.length === 0) {
      console.warn("⚠️ No se encontraron coordenadas para:", cleanAddress)
      return null
    }

    const [lng, lat] = data.features[0].center

    if (!lat || !lng) {
      return null
    }

    return {
      lat: Number(lat),
      lng: Number(lng)
    }

  } catch (error) {

    if (error.name === "AbortError") {
      console.error("⏱ Mapbox timeout:", address)
    } else {
      console.error("❌ Geocoding error:", error.message)
    }

    return null

  }

}

export default geocodeAddress