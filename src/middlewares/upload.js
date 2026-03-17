import multer from "multer"
import path from "path"
import fs from "fs"

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Definimos la carpeta base dependiendo del campo que viene del frontend
    let folder = "uploads/"
    
    if (file.fieldname === "documento_achs") {
      folder = "uploads/ACHS/"
    }

    // Crear la carpeta si no existe (importante para entornos Linux/Render)
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
    
    cb(null, folder)
  },
  filename: (req, file, cb) => {
    // Generamos un nombre único: campo-timestamp-aleatorio.extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  }
})

// Filtro para asegurar que solo suban lo que corresponde
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "documento_achs") {
    if (file.mimetype === "application/pdf") {
      cb(null, true)
    } else {
      cb(new Error("La ACHS debe ser un archivo PDF"), false)
    }
  } else {
    // Para la foto permitimos imágenes
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("La foto debe ser una imagen válida"), false)
    }
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

export default upload