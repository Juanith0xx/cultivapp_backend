import { supabase } from '../../database/supabase.js';

export const getChains = async (req, res) => {
  try {
    const { company_id } = req.query;

    if (!company_id) {
      return res.status(400).json({ error: "Falta el ID de la empresa" });
    }

    const { data, error } = await supabase
      .from('chains')
      .select('*')
      .eq('company_id', company_id);

    if (error) throw error;

    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};