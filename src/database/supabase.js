import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Forzamos la carga del .env desde la raíz del proyecto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug para ver qué está leyendo Node (esto lo puedes borrar después)
if (!supabaseUrl) {
  console.error("❌ ERROR: SUPABASE_URL no definida en .env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);