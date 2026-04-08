import { supabase } from '../../database/supabase.js'; 

/**
 * 🚀 ENVIAR NOTIFICACIÓN (Individual / Local)
 */
export const sendNotification = async (req, res) => {
  try {
    const { title, message, scope, targetId, companyId, type } = req.body;
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
      type: type || 'info',
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
 * 🔥 ENVIAR NOTIFICACIONES MASIVAS (Bulk por Rol)
 */
export const sendBulkNotifications = async (req, res) => {
  try {
    const { title, message, targetRole, companyId, type } = req.body;
    const sender_id = req.user.id;

    const tenant_id = req.user.role === 'ROOT' ? companyId : req.user.company_id;

    // 1. Buscamos a todos los usuarios que coincidan con el Rol y la Empresa
    let userQuery = supabase.from('users').select('id');
    
    if (targetRole) userQuery = userQuery.eq('role', targetRole);
    if (tenant_id) userQuery = userQuery.eq('company_id', tenant_id);

    const { data: users, error: userError } = await userQuery;

    if (userError) throw userError;
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: "No se encontraron usuarios." });
    }

    // 2. Preparamos inserción masiva
    const bulkNotifications = users.map(user => ({
      tenant_id,
      sender_id,
      title,
      message,
      type: type || 'warning',
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
 * 🔔 OBTENER MIS NOTIFICACIONES (Mejorado para Perfil de Usuario)
 */
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const companyId = req.user?.company_id;
    const localId = req.user?.local_id;
    const role = req.user?.role;

    // Solo el ROOT puede saltarse el company_id
    if (!companyId && role !== 'ROOT') {
      return res.status(400).json({ error: "Configuración de empresa incompleta." });
    }

    // --- MEJORA: Construcción de filtro por pertenencia ---
    // El usuario ve: 1. Lo que es para él (id) O 2. Lo que es Global
    let orFilter = `target_user_id.eq.${userId},scope.eq.global`;

    // 3. O lo que es para su Local específico
    if (localId && localId !== 'undefined' && localId !== 'null') {
      orFilter += `,and(scope.eq.local,target_local_id.eq.${localId})`;
    }

    let query = supabase.from('notifications').select('*').or(orFilter);

    // Seguridad adicional: No mezclar datos entre empresas
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
 * 🚩 MARCAR COMO LEÍDA (Validando propiedad)
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Obtenemos el ID del token/auth

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('target_user_id', userId) // 🔥 Seguridad: Solo puedes leer las tuyas
      .select();

    if (error) throw error;
    
    if (data.length === 0) {
      return res.status(403).json({ success: false, message: "No tienes permiso o la notificación no existe." });
    }

    res.status(200).json({ success: true, message: 'Leída', data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🚩 MARCAR TODAS COMO LEÍDAS (Validando propiedad)
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .eq('target_user_id', userId); // 🔥 Solo afecta a las del usuario actual

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Historial actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};