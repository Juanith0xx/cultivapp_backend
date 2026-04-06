import { supabase } from '../../database/supabase.js'; 

/**
 * 🚀 Enviar Notificación (Admin / Root / Supervisor)
 */
export const sendNotification = async (req, res) => {
  try {
    const { title, message, scope, targetId, companyId } = req.body;
    const sender_id = req.user.id; 

    // Si es ROOT, usa el companyId del form, si no, su propio company_id
    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

    if (!tenant_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se pudo determinar el Tenant ID (Empresa)' 
      });
    }

    const notificationData = {
      tenant_id,
      sender_id,
      title,
      message,
      scope,
      target_user_id: scope === 'individual' && targetId ? targetId : null,
      target_local_id: scope === 'local' && targetId ? targetId : null
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Notificación enviada con éxito',
      data: data[0]
    });

  } catch (error) {
    console.error('❌ Error en sendNotification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔔 Obtener Notificaciones del Usuario actual (CORREGIDO)
 */
export const getMyNotifications = async (req, res) => {
  try {
    // 1. Limpiamos las variables para asegurar que sean UUIDs válidos o nulos, nunca "undefined"
    const userId = req.user?.id;
    const companyId = req.user?.company_id;
    const localId = req.user?.local_id;

    if (!companyId) {
      return res.status(400).json({ error: "El usuario no tiene una empresa asignada." });
    }

    // 2. Construimos el filtro dinámicamente para evitar enviar "undefined" a Postgres
    // Filtro base: Siempre ver las Globales y las Individuales para mi ID
    let orFilter = `scope.eq.global,and(scope.eq.individual,target_user_id.eq.${userId})`;

    // Solo agregar el filtro de local si el usuario realmente tiene un local_id
    if (localId && localId !== 'undefined' && localId !== 'null') {
      orFilter += `,and(scope.eq.local,target_local_id.eq.${localId})`;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('tenant_id', companyId)
      .or(orFilter) // 🚩 Usamos el filtro limpio construido arriba
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    res.status(200).json(data); // Devolvemos data directamente para que el frontend lo mapee fácil

  } catch (error) {
    console.error('❌ Error en getMyNotifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};