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
      read_at: null,
      target_user_id: scope === 'individual' ? targetId : null,
      target_local_id: scope === 'local' ? targetId : null,
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    console.error("❌ sendNotification Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔥 ENVIAR NOTIFICACIONES MASIVAS (Bulk)
 */
export const sendBulkNotifications = async (req, res) => {
  try {
    console.log("📦 [send-bulk] body recibido:", JSON.stringify(req.body, null, 2));

    const { title, message, scope, targetIds, companyId, localId, type } = req.body;
    const sender_id = req.user.id;
    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

    if (!tenant_id) {
      return res.status(400).json({ success: false, message: 'Falta ID de empresa' });
    }

    // ✅ Normalizar targetIds: acepta string, array, o undefined
    const normalizedTargetIds = targetIds
      ? (Array.isArray(targetIds) ? targetIds : [targetIds])
      : [];

    let notifications = [];

    // --- CASO 1: EMISIÓN GLOBAL (EMPRESA) ---
    if (scope === 'TODOS') {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', tenant_id)
        .is('deleted_at', null);

      if (usersError) throw usersError;
      if (!users || users.length === 0) {
        return res.status(404).json({ success: false, message: 'No hay usuarios en esta empresa' });
      }

      notifications = users.map(u => ({
        tenant_id,
        sender_id,
        title,
        message,
        scope: 'global',
        is_read: false,
        type: type || 'info',
        target_user_id: u.id,
      }));
    }

    // --- CASO 2: EMISIÓN POR PUNTO DE VENTA ---
    else if (scope === 'local') {
      if (!localId) {
        return res.status(400).json({ success: false, message: 'Falta el ID del local' });
      }

      const today = new Date().getDay();
      const todayIso = new Date().toISOString().split('T')[0];

      const { data: routes, error: routeError } = await supabase
        .from('user_routes')
        .select('user_id')
        .eq('local_id', localId)
        .is('deleted_at', null)
        .or(`visit_date.eq.${todayIso},and(is_recurring.eq.true,day_of_week.eq.${today})`);

      if (routeError) throw routeError;

      const uniqueUserIds = [...new Set((routes || []).map(r => r.user_id))];

      if (uniqueUserIds.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No hay mercaderistas planificados en este local para hoy.'
        });
      }

      notifications = uniqueUserIds.map(uid => ({
        tenant_id,
        sender_id,
        title,
        message,
        scope: 'local',
        is_read: false,
        type: type || 'info',
        target_user_id: uid,
        target_local_id: localId,
      }));
    }

    // --- CASO 3: SELECCIÓN INDIVIDUAL ---
    else if (scope === 'individual') {
      if (normalizedTargetIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No se especificaron destinatarios' });
      }

      notifications = normalizedTargetIds.map(id => ({
        tenant_id,
        sender_id,
        title,
        message,
        scope: 'individual',
        is_read: false,
        type: type || 'info',
        target_user_id: id,
      }));
    }

    // --- CASO 4: ZONA (pendiente de implementar filtro por zona) ---
    else if (scope === 'ZONA') {
      return res.status(400).json({ success: false, message: 'Envío por zona aún no implementado' });
    }

    else {
      return res.status(400).json({ success: false, message: `Scope inválido: ${scope}` });
    }

    if (notifications.length === 0) {
      return res.status(400).json({ success: false, message: 'No se generaron destinatarios' });
    }

    // ✅ ignoreDuplicates evita 500 por constraint uq_notif_user_type_related
    const { error } = await supabase
      .from('notifications')
      .insert(notifications, { ignoreDuplicates: true });

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: `Instrucción enviada a ${notifications.length} destinatarios.`
    });
  } catch (error) {
    console.error("❌ sendBulkNotifications Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔔 OBTENER MIS NOTIFICACIONES (SaaS Isolation)
 */
export const getMyNotifications = async (req, res) => {
  try {
    const { id: userId, company_id: tenant_id, role } = req.user;

    let query = supabase.from('notifications').select('*');

    if (role === 'ROOT') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query
        .eq('tenant_id', tenant_id)
        .eq('target_user_id', userId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error("❌ getMyNotifications Error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 📤 HISTORIAL DE ENVIADOS (Trazabilidad para Supervisor)
 */
export const getSentNotifications = async (req, res) => {
  try {
    const { id, role, company_id } = req.user;

    let query = supabase.from('notifications').select(`
      *,
      target_user:target_user_id (first_name, last_name, rut)
    `);

    if (role === 'ROOT') {
      // Root ve todo
    } else if (role === 'ADMIN_CLIENTE' || role === 'SUPERVISOR') {
      query = query.eq('tenant_id', company_id);
    } else {
      query = query.eq('sender_id', id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error("❌ getSentNotifications Error:", error);
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
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ markAsRead Error:", error);
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
    console.error("❌ deleteNotification Error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🚩 MARCAR TODAS COMO LEÍDAS
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: now
      })
      .eq('target_user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ markAllAsRead Error:", error);
    res.status(500).json({ error: error.message });
  }
};