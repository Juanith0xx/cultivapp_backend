import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 1. Priorizamos datos del TOKEN (req.user) porque son más fiables que el body
    const companyName = req.user?.company_name || "default_tenant";
    
    // Intentamos obtener el nombre desde: 
    // a) El body (si el frontend lo envió antes del archivo)
    // b) El token (si tu middleware inyecta 'first_name' y 'last_name')
    // c) Un fallback genérico
    const rawUserName = req.body.user_full_name || 
                        (req.user?.first_name ? `${req.user.first_name} ${req.user.last_name}` : null) || 
                        req.user?.full_name || 
                        "usuario_desconocido";

    const slugify = (text) => text
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    const safeCompany = slugify(companyName);
    const safeUser = slugify(rawUserName);

    // Definimos la carpeta base
    let folder = `uploads/${safeCompany}/${safeUser}/`;

    if (file.fieldname === "documento_achs") {
      folder += `doc_achs/`;
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
    const ext = path.extname(file.originalname);
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0]; 
    const hora = ahora.getHours().toString().padStart(2, '0') + "h" + 
                 ahora.getMinutes().toString().padStart(2, '0');

    const routeId = req.params.id || req.body.visit_id || "sin_id";
    const random = Math.round(Math.random() * 1e3);
    cb(null, `visita_${routeId}_${fecha}_${hora}_${random}${ext}`);
  }
});

const upload = multer({ storage });
export default upload;