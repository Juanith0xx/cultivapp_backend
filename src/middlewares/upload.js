import multer from "multer"
import path from "path"
import fs from "fs"

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 1. Obtener nombre de empresa (del token)
    const companyName = req.user?.company_name || "default_tenant";
    
    // 2. Obtener nombre de usuario (enviado desde el modal en el req.body)
    // Usamos el body si viene, si no, el del token, o un default.
    const rawUserName = req.body.user_full_name || req.user?.full_name || "usuario_desconocido";

    // Función para limpiar nombres (quitar tildes, espacios, etc)
    const slugify = (text) => text
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    const safeCompany = slugify(companyName);
    const safeUser = slugify(rawUserName);

    let folder = `uploads/${safeCompany}/`;

    // 🚩 MEJORA: Estructura específica para ACHS
    if (file.fieldname === "documento_achs") {
      folder += `doc_achs/${safeUser}/`;
    } 
    else if (file.fieldname === "file") { 
      folder += "excels_temporales/"; 
    } 
    else if (file.fieldname === "foto") { 
      const tipo = req.body.tipo_evidencia || "perfiles";
      const mapeoCarpetas = {
        'fachada': 'foto_local',
        'gondola_inicio': 'foto_gondola',
        'gondola_final': 'foto_term_producto',
        'observaciones': 'observaciones'
      };
      const subCarpeta = mapeoCarpetas[tipo] || "otros";
      
      // Si es foto de perfil, también la metemos en la carpeta del usuario
      if (tipo === "perfiles") {
        folder += `perfiles/${safeUser}/`;
      } else {
        folder += `evidencias/${subCarpeta}/`;
      }
    }

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0]; 
    const hora = ahora.getHours().toString().padStart(2, '0') + "h" + 
                 ahora.getMinutes().toString().padStart(2, '0');

    // Si es ACHS, le damos un nombre más profesional
    if (file.fieldname === "documento_achs") {
      cb(null, `ACHS_${fecha}_${hora}${ext}`);
    } else {
      const routeId = req.params.id || "sin_ruta";
      const random = Math.round(Math.random() * 1e3);
      cb(null, `visita_${routeId}_${fecha}_${hora}_${random}${ext}`);
    }
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
    cb(null, true); // Permitir otros campos si es necesario
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // Aumentado a 15MB por los PDFs
})

export default upload;