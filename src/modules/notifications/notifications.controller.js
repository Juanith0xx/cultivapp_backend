import { supabase } from '../../database/supabase.js'; 

/**
<<<<<<< HEAD
 * 🚀 ENVIAR NOTIFICACIÓN (Individual / Local)
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
    const { title, message, targetRole, companyId, type } = req.body;
    const sender_id = req.user.id;
    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

    let userQuery = supabase.from('users').select('id');
    if (targetRole) userQuery = userQuery.eq('role', targetRole);
    if (tenant_id) userQuery = userQuery.eq('company_id', tenant_id);

    const { data: users, error: userError } = await userQuery;
    if (userError) throw userError;

    const bulkNotifications = users.map(u => ({
      tenant_id,
      sender_id,
      title,
      message,
      type: type || 'warning',
      scope: 'individual', 
      target_user_id: u.id,
      is_read: false
    }));

    const { error: insertError } = await supabase.from('notifications').insert(bulkNotifications);
    if (insertError) throw insertError;

    res.status(201).json({ success: true, message: `Enviadas a ${users.length} usuarios.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🔔 OBTENER MIS NOTIFICACIONES (Blindado)
 * Esta función es la que garantiza que el usuario vea SOLO lo suyo.
 */
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    const localId = req.user.local_id;
    const role = req.user.role;

    // 1. Construcción del filtro OR (PostgREST)
    // El usuario puede ver: 1. Su ID individual, 2. Scope global, 3. Su Local ID
    let orConditions = `target_user_id.eq.${userId},scope.eq.global`;
    
    if (localId && localId !== 'null') {
      orConditions += `,and(scope.eq.local,target_local_id.eq.${localId})`;
    }

    let query = supabase.from('notifications').select('*').or(orConditions);

    // 2. Filtro estricto por Empresa (Tenant)
    // Si no es ROOT, solo puede ver lo que pertenece a su tenant_id
    if (role !== 'ROOT') {
      query = query.eq('tenant_id', companyId);
=======
 * 🔔 OBTENER NOTIFICACIONES (SaaS Isolation & Visibility)
 * Resuelve el error de la bandeja vacía para el ROOT.
 */
export const getMyNotifications = async (req, res) => {
  try {
    const { id: userId, company_id: tenant_id, local_id, role } = req.user;

    let query = supabase.from('notifications').select('*');

    // 🚩 LÓGICA DE VISIBILIDAD:
    if (role === 'ROOT') {
      // El ROOT ve absolutamente todo el historial del sistema para monitoreo
      // Si prefieres que el ROOT solo vea las de su propia "empresa administradora", 
      // podrías añadir .eq('tenant_id', tenant_id)
      query = query.order('created_at', { ascending: false });
    } 
    else {
      // 🛡️ AISLAMIENTO SAAS (Usuarios y Admins de Clientes)
      // Filtro OR: (Para mi ID) O (Es Global de mi empresa) O (De mi Local específico)
      let orFilter = `target_user_id.eq.${userId},scope.eq.global`;
      
      if (local_id) {
        orFilter += `,and(scope.eq.local,target_local_id.eq.${local_id})`;
      }

      query = query.or(orFilter).eq('tenant_id', tenant_id);
>>>>>>> a34866a (fix funcion notificaiones)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // 🚩 3. FILTRO DE SEGURIDAD MANUAL (Última barrera)
    // Por si el filtro .or() falla o se salta, limpiamos el array antes de enviarlo.
    const securedData = data.filter(n => {
      if (role === 'ROOT') return true; // ROOT ve todo lo de la query
      
      const isForMe = n.target_user_id === userId;
      const isGlobal = n.scope === 'global' && n.tenant_id === companyId;
      const isMyLocal = n.scope === 'local' && n.target_local_id === localId;
      
      return isForMe || isGlobal || isMyLocal;
    });

    res.status(200).json(securedData);
  } catch (error) {
    console.error('❌ Error getMyNotifications:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
<<<<<<< HEAD
 * 📤 HISTORIAL DE ENVIADOS
=======
 * 🚀 ENVIAR NOTIFICACIÓN SIMPLE
 */
export const sendNotification = async (req, res) => {
  try {
    const { title, message, scope, targetId, companyId, type } = req.body;
    const sender_id = req.user.id; 
    
    // Si el emisor es ROOT, usa la empresa destino enviada, si no, su propia empresa
    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

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

    let finalTargets = [];

    // Si es global, el array de targetIds puede venir vacío, 
    // pero para la DB necesitamos al menos una entrada o manejar el scope
    if (scope === 'global') {
      finalTargets = [null]; // Se crea una sola entrada global para la empresa
    } else {
      finalTargets = targetIds;
    }

    const notifications = finalTargets.map(id => ({
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

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) throw error;

    res.status(201).json({ success: true, message: 'Alertas masivas enviadas con éxito' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * ✅ MARCAR COMO LEÍDA
>>>>>>> a34866a (fix funcion notificaiones)
 */
export const getSentNotifications = async (req, res) => {
  try {
<<<<<<< HEAD
    const { id, role, company_id } = req.user;
    let query = supabase.from('notifications').select('*');

    if (role === 'ROOT') {
      // Root ve todo el historial
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
=======
    const { id } = req.params;

    // 🚩 FIX: Eliminamos el filtro estricto de target_user_id 
    // para permitir marcar como leídas las notificaciones globales.
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
>>>>>>> a34866a (fix funcion notificaiones)
  }
};

/**
 * 🗑️ ELIMINAR NOTIFICACIÓN
<<<<<<< HEAD
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role, company_id: tenantId } = req.user;

    let query = supabase.from('notifications').delete().eq('id', id);

    if (role !== 'ROOT') {
      // Un admin solo borra de su empresa, un supervisor solo lo suyo
      if (role === 'ADMIN_CLIENTE') {
        query = query.eq('tenant_id', tenantId);
      } else {
        query = query.eq('sender_id', userId);
      }
    }

    const { data, error } = await query.select();
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return res.status(403).json({ success: false, message: "No permitido o no existe." });
    }

    res.status(200).json({ success: true, message: "Eliminada." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🚩 MARCAR COMO LEÍDA (Estrictamente personal)
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // El filtro .eq('target_user_id', userId) garantiza que no marques nada ajeno
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('target_user_id', userId) 
      .select();

    if (error) throw error;
    if (data.length === 0) return res.status(403).json({ error: "No tienes permiso." });

    res.status(200).json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🚩 MARCAR TODAS COMO LEÍDAS
=======
>>>>>>> a34866a (fix funcion notificaiones)
 */
export const deleteNotification = async (req, res) => {
  try {
<<<<<<< HEAD
    const userId = req.user.id;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .eq('target_user_id', userId);
=======
    const { id } = req.params;
    const { role, company_id } = req.user;

    let query = supabase.from('notifications').delete().eq('id', id);
    
    // Si no es ROOT, solo puede borrar notificaciones de su propia empresa
    if (role !== 'ROOT') {
      query = query.eq('tenant_id', company_id);
    }
>>>>>>> a34866a (fix funcion notificaiones)

    const { error } = await query;
    if (error) throw error;
<<<<<<< HEAD
    res.status(200).json({ success: true });
=======

    res.status(200).json({ success: true, message: 'Notificación eliminada' });
>>>>>>> a34866a (fix funcion notificaiones)
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};