import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const slugify = (text) => {
      if (!text || text === "undefined" || text === "null") return null;
      return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
    };

    const rawCompany = req.user?.company_name || req.body.company_name;
    const rawUser = req.user?.full_name || req.body.user_name;

    const safeCompany = slugify(rawCompany) || "default_tenant";
    const safeUser = slugify(rawUser) || "usuario_desconocido";

    // Estructura: uploads/empresa/usuario/evidencias/tipo_foto
    let relativePath = path.join(safeCompany, safeUser, "evidencias");

    if (file.fieldname === "foto") { 
      const tipo = req.body.tipo_evidencia || "otros";
      const mapeo = {
        'Fachada': 'foto_local',
        'Góndola Inicio': 'foto_gondola',
        'Góndola Final': 'foto_term_producto',
        'Observaciones': 'foto_observaciones'
      };
      const subCarpeta = mapeo[tipo] || "otros";
      relativePath = path.join(relativePath, subCarpeta);
    }

    const finalFolder = path.join("uploads", relativePath);

    if (!fs.existsSync(finalFolder)) {
      fs.mkdirSync(finalFolder, { recursive: true });
    }

    cb(null, finalFolder);
  },

  filename: (req, file, cb) => {
    // 1. Forzamos extensión en minúsculas (evita líos .JPG vs .jpg en Linux)
    const ext = path.extname(file.originalname).toLowerCase();
    
    // 2. Formateamos Fecha y Hora (Ej: 2026-04-15_12h30m45s)
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
    const hora = `${ahora.getHours()}h${ahora.getMinutes()}m${ahora.getSeconds()}s`;
    
    // 3. Mapeo para prefijo descriptivo
    const mapeoPrefijos = {
      'Fachada': 'LOCAL',
      'Góndola Inicio': 'GONDOLA_INI',
      'Góndola Final': 'GONDOLA_FIN',
      'Observaciones': 'OBS'
    };
    const prefijo = mapeoPrefijos[req.body.tipo_evidencia] || "EVIDENCIA";
    
    // 4. ID de visita corto (últimos 8 caracteres para no alargar tanto el nombre)
    const visitId = req.body.visit_id ? req.body.visit_id.slice(-8) : "sinid";

    /**
     * RESULTADO FINAL: 
     * GONDOLA_INI_2026-04-15_12h30m45s_ff9e5863.png
     */
    cb(null, `${prefijo}_${fecha}_${hora}_${visitId}${ext}`);
  }
});

const upload = multer({ storage });
export default upload;