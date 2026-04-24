import multer from "multer"
import path from "path"
import fs from "fs"

// 📂 Carpeta temporal: Aquí caerán los Excels y Fotos inicialmente
const tempDir = "uploads/temp";
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Todo va a temp; el controlador correspondiente lo moverá a su carpeta final
    cb(null, tempDir); 
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Ejemplo: file-1713961200000-123456.xlsx o foto-1713961200000-987654.jpg
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
})

/**
 * 🛠️ FILTRO DE SEGURIDAD
 * Valida extensiones según el nombre del campo (fieldname)
 */
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "documento_achs") {
    // Solo PDFs para ACHS
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("La ACHS debe ser un archivo PDF"), false);
  } 
  else if (file.fieldname === "file") {
    // Validación estricta para Excel (Carga Masiva de Rutas)
    const isExcel = 
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.match(/\.(xlsx|xls)$/);
    
    if (isExcel) cb(null, true);
    else cb(new Error("Archivo Excel inválido para la carga masiva"), false);
  }
  else if (file.fieldname === "foto") {
    // Solo imágenes para evidencias
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Debe ser una imagen válida"), false);
  }
  else {
    // Permitir por defecto otros campos si fuera necesario
    cb(null, true); 
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 15 * 1024 * 1024 // Límite de 15MB (Suficiente para Excels grandes y fotos HD)
  }, 
})

export default upload;