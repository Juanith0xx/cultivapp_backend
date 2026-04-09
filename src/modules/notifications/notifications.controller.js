import { supabase } from '../../database/supabase.js';

/**
 * 🚀 ENVIAR NOTIFICACIÓN SIMPLE (Individual / Local)
 */
export const sendNotification = async (req, res) => {
  try {
    const { title, message, scope, targetId, companyId, type } = req.body;
    const sender_id = req.user.id;
    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

    if (!tenant_id && scope !== 'global_root') {
      return res.status(400).json({ success: false, message: 'Falta ID de empresa' });
    }

    const notificationData = {
      tenant_id,
      sender_id,
      title,
      message,
      type: type || 'info',
      scope,
      is_read: false,
      target_user_id: scope === 'individual' ? targetId : null,
      target_local_id: scope === 'local' ? targetId : null
    };

    const { data, error } = await supabase.from('notifications').insert([notificationData]).select();
    if (error) throw error;

    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔥 ENVIAR NOTIFICACIONES MASIVAS (Bulk)
 */
export const sendBulkNotifications = async (req, res) => {
  try {
    const { title, message, scope, targetIds, companyId, localId } = req.body;
    const sender_id = req.user.id;
    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

    let notifications = [];

    if (scope === 'global') {
      notifications = [{
        tenant_id,
        sender_id,
        title,
        message,
        scope: 'global',
        is_read: false,
        type: 'info'
      }];
    } else {
      // targetIds viene del frontend como un array de IDs de usuarios
      notifications = targetIds.map(id => ({
        tenant_id,
        sender_id,
        title,
        message,
        scope,
        is_read: false,
        target_user_id: scope === 'individual' ? id : null,
        target_local_id: scope === 'local' ? localId : null,
        type: 'info'
      }));
    }

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) throw error;

    res.status(201).json({ success: true, message: 'Alertas masivas enviadas con éxito' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔔 OBTENER MIS NOTIFICACIONES (SaaS Isolation)
 */
export const getMyNotifications = async (req, res) => {
  try {
    const { id: userId, company_id: tenant_id, local_id, role } = req.user;

    let query = supabase.from('notifications').select('*');

    if (role === 'ROOT') {
      // El ROOT ve todo el historial del sistema
      query = query.order('created_at', { ascending: false });
    } else {
      // Filtro para usuarios normales y admins de clientes
      let orFilter = `target_user_id.eq.${userId},scope.eq.global`;
      if (local_id) {
        orFilter += `,and(scope.eq.local,target_local_id.eq.${local_id})`;
      }
      query = query.or(orFilter).eq('tenant_id', tenant_id);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📤 HISTORIAL DE ENVIADOS
 */
export const getSentNotifications = async (req, res) => {
  try {
    const { id, role, company_id } = req.user;
    let query = supabase.from('notifications').select('*');

    if (role === 'ROOT') {
      // Root ve todo
    } else if (role === 'ADMIN_CLIENTE') {
      query = query.eq('tenant_id', company_id);
    } else {
      query = query.eq('sender_id', id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * ✅ MARCAR COMO LEÍDA
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🗑️ ELIMINAR NOTIFICACIÓN
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user;

    let query = supabase.from('notifications').delete().eq('id', id);
    
    if (role !== 'ROOT') {
      query = query.eq('tenant_id', company_id);
    }

    const { error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, message: 'Notificación eliminada' });
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
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('target_user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};