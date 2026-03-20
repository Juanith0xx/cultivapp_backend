import multer from "multer"
import path from "path"
import fs from "fs"

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "uploads/"
    
    // 🚩 Definimos carpetas por tipo de archivo
    if (file.fieldname === "documento_achs") {
      folder = "uploads/ACHS/"
    } else if (file.fieldname === "file") { 
      folder = "uploads/temp_excel/" // Carpeta temporal para los Excel de locales
    }

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
    
    cb(null, folder)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  // 1. Validar PDF de ACHS
  if (file.fieldname === "documento_achs") {
    if (file.mimetype === "application/pdf") {
      cb(null, true)
    } else {
      cb(new Error("La ACHS debe ser un archivo PDF"), false)
    }
  } 
  // 2. Validar EXCEL de Locales (🚩 NUEVA REGLA)
  else if (file.fieldname === "file") {
    const isExcel = 
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.match(/\.(xlsx|xls)$/)

    if (isExcel) {
      cb(null, true)
    } else {
      cb(new Error("El archivo de locales debe ser un Excel (.xlsx o .xls)"), false)
    }
  }
  // 3. Validar FOTOS (para reponedores/perfil)
  else {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("El archivo enviado debe ser una imagen válida"), false)
    }
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // Subimos a 10MB por si el Excel es pesado
})

export default upload