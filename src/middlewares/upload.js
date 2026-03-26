import multer from "multer"
import path from "path"
import fs from "fs"

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const companyName = req.user?.company_name || "default_tenant";
    
    // Sanitización del nombre de la empresa para la carpeta
    const safeName = companyName
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    let folder = `uploads/${safeName}/`;

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

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    // 🚩 MEJORA DE AUDITORÍA: Fecha y Hora legible
    const routeId = req.params.id || "sin_ruta";
    
    const ahora = new Date();
    
    // Formato: 2026-03-25
    const fecha = ahora.toISOString().split('T')[0]; 
    
    // Formato: 21h45 (Hora local del servidor)
    const hora = ahora.getHours().toString().padStart(2, '0') + "h" + 
                 ahora.getMinutes().toString().padStart(2, '0');

    // Mantenemos un sufijo aleatorio pequeño por si se suben 2 fotos en el mismo minuto
    const random = Math.round(Math.random() * 1e3);
    const ext = path.extname(file.originalname);
    
    // Ejemplo: visita_a538..._2026-03-25_21h45_842.png
    cb(null, `visita_${routeId}_${fecha}_${hora}_${random}${ext}`);
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