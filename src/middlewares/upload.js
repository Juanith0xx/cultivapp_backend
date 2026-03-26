import multer from "multer"
import path from "path"
import fs from "fs"

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 🚩 1. Identificar el nombre de la empresa
    const companyName = req.user?.company_name || "default_tenant";
    
    // 🚩 2. "Sanitizar" el nombre: "Santa Isabel" -> "santa_isabel"
    // Esto quita espacios, tildes y caracteres especiales
    const safeName = companyName
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quita tildes
      .replace(/\s+/g, "_")           // Cambia espacios por guiones bajos
      .replace(/[^a-z0-9_]/g, "");    // Quita todo lo que no sea letra, número o _

    let folder = `uploads/${safeName}/`;

    // 3. Lógica de carpetas dinámicas
    if (file.fieldname === "documento_achs") {
      folder += "documentos/ACHS/";
    } 
    else if (file.fieldname === "file") { 
      folder += "excels_temporales/"; 
    } 
    else if (file.fieldname === "foto") { 
      const tipo = req.body.tipo_evidencia || "otros";
      
      const mapeoCarpetas = {
        'fachada': 'foto_local',
        'gondola_inicio': 'foto_gondola',
        'gondola_final': 'foto_term_producto',
        'observaciones': 'observaciones'
      };

      const subCarpeta = mapeoCarpetas[tipo] || "otros";
      folder += `evidencias/${subCarpeta}/`;
    }

    // 4. Crear estructura de carpetas recursiva
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const routeId = req.params.id || "sin_ruta";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e4);
    const ext = path.extname(file.originalname);
    
    cb(null, `visita_${routeId}_${uniqueSuffix}${ext}`);
  }
})

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
    cb(new Error("Campo no reconocido"), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
})

export default upload;