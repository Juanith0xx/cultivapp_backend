import { supabase } from '../../database/supabase.js'; 

/**
 * 🚀 ENVIAR NOTIFICACIÓN (Individual)
 */
export const sendNotification = async (req, res) => {
  try {
    const { title, message, scope, targetId, companyId } = req.body;
    const sender_id = req.user.id; 

    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

    if (!tenant_id && scope !== 'global_root') {
      return res.status(400).json({ 
        success: false, 
        message: 'No se pudo determinar el ID de empresa' 
      });
    }

    const notificationData = {
      tenant_id: tenant_id || null,
      sender_id,
      title,
      message,
      scope,
      is_read: false,
      target_user_id: scope === 'individual' && targetId ? targetId : null,
      target_local_id: scope === 'local' && targetId ? targetId : null
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    console.error('❌ Error en sendNotification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔥 NUEVA MEJORA: ENVIAR NOTIFICACIONES MASIVAS (Bulk)
 * Permite al ROOT enviar una alerta a todos los usuarios de un rol específico (ej: ADMIN_CLIENTE)
 */
export const sendBulkNotifications = async (req, res) => {
  try {
    const { title, message, targetRole, companyId } = req.body;
    const sender_id = req.user.id;

    // Si eres ROOT, usas el companyId enviado; si no, tu propia empresa
    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

    // 1. Buscamos a todos los usuarios que coincidan con el Rol y la Empresa
    let userQuery = supabase.from('users').select('id');
    
    if (targetRole) userQuery = userQuery.eq('role', targetRole);
    if (tenant_id) userQuery = userQuery.eq('company_id', tenant_id);

    const { data: users, error: userError } = await userQuery;

    if (userError) throw userError;
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: "No se encontraron usuarios para este envío masivo." });
    }

    // 2. Preparamos el array de inserción (Una notificación por cada usuario para trackear el is_read individual)
    const bulkNotifications = users.map(user => ({
      tenant_id,
      sender_id,
      title,
      message,
      scope: 'individual', 
      target_user_id: user.id,
      is_read: false
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(bulkNotifications);

    if (insertError) throw insertError;

    res.status(201).json({
      success: true,
      message: `Notificaciones enviadas con éxito a ${users.length} usuarios.`
    });

  } catch (error) {
    console.error('❌ Error en sendBulkNotifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔔 OBTENER MIS NOTIFICACIONES
 */
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.company_id;
    const localId = req.user?.local_id;
    const role = req.user?.role;

    if (!companyId && role !== 'ROOT') {
      return res.status(400).json({ error: "El usuario no tiene una empresa asignada." });
    }

    let orFilter = `scope.eq.global,target_user_id.eq.${userId}`;

    if (localId && localId !== 'undefined' && localId !== 'null') {
      orFilter += `,and(scope.eq.local,target_local_id.eq.${localId})`;
    }

    let query = supabase.from('notifications').select('*').or(orFilter);

    if (role !== 'ROOT') {
      query = query.eq('tenant_id', companyId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('❌ Error en getMyNotifications:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🚩 MARCAR COMO LEÍDA
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.status(200).json({ success: true, message: 'Leída', data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🚩 MARCAR TODAS COMO LEÍDAS
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    let query = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);

    if (req.user.role !== 'ROOT') {
      query = query.eq('tenant_id', companyId);
    }

    const { error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, message: 'Todas las alertas gestionadas' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};