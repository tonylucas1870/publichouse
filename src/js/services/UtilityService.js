import { supabase } from '../lib/supabase.js';

export class UtilityService {
  async getUtilities(propertyId) {
    const { data, error } = await supabase
      .from('utilities')
      .select('*')
      .eq('property_id', propertyId)
      .order('type');

    if (error) throw error;
    return data || [];
  }

  async addUtility({ type, provider, accountNumber, notes, propertyId }) {
    const { data, error } = await supabase
      .from('utilities')
      .insert({
        type,
        provider,
        account_number: accountNumber,
        notes,
        property_id: propertyId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteUtility(utilityId) {
    const { error } = await supabase
      .from('utilities')
      .delete()
      .eq('id', utilityId);

    if (error) throw error;
  }
}