import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const slugify = (text) => {
      if (!text || text === "undefined" || text === "null") return null;
      return text.toLowerCase().trim().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    };

    // 🚩 MEJORA: Buscamos en todas las fuentes posibles
    // Si req.user no tiene la info, es porque el middleware de auth falló o no inyectó company_name
    const rawCompany = req.user?.company_name || req.body.company_name || req.headers['x-company-name'];
    const rawUser = req.user?.full_name || req.body.user_name || req.headers['x-user-name'];

    const safeCompany = slugify(rawCompany) || "default_tenant";
    const safeUser = slugify(rawUser) || "usuario_desconocido";

    // path.join maneja las barras según el SO, pero en web queremos "/"
    // Forzamos la creación de la ruta
    let folder = `uploads/${safeCompany}/${safeUser}`;

    if (file.fieldname === "foto") { 
      const tipo = req.body.tipo_evidencia || "otros";
      const mapeo = {
        'Fachada': 'foto_local',
        'Góndola Inicio': 'foto_gondola',
        'Góndola Final': 'foto_term_producto',
        'Observaciones': 'foto_observaciones'
      };
      folder += `/evidencias/${mapeo[tipo] || "otros"}`;
    }

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const ahora = new Date();
    // Nombre de archivo limpio sin caracteres extraños
    const timestamp = ahora.getTime();
    const visitId = req.body.visit_id || req.params.id || "sin_id";
    cb(null, `visita_${visitId}_${timestamp}${ext}`);
  }
});

const upload = multer({ storage });
export default upload;