import multer from "multer"
import path from "path"
import fs from "fs"

// Carpeta temporal
const tempDir = "uploads/temp";
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir); // Siempre a temp primero para procesar nombres reales después
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
})

// Mantenemos TODOS tus filtros de seguridad (PDF, Excel, Imagen)
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "documento_achs") {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("La ACHS debe ser un archivo PDF"), false);
  } 
  else if (file.fieldname === "file") {
    const isExcel = file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
                    file.mimetype === "application/vnd.ms-excel" ||
                    file.originalname.match(/\.(xlsx|xls)$/);
    if (isExcel) cb(null, true);
    else cb(new Error("Archivo Excel inválido"), false);
  }
  else if (file.fieldname === "foto") {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Debe ser una imagen válida"), false);
  }
  else {
    cb(null, true); 
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, 
})

export default upload;