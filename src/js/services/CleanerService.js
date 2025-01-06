import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class CleanerService {
  async getCleaners(propertyId) {
    try {
      const { data, error } = await supabase
        .from('cleaner_details')
        .select('id, user_id, user_email')
        .eq('property_id', propertyId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load cleaners');
    }
  }

  async addCleaner(propertyId, email) {
    try {
      // First get the user ID for the email
      const { data, error: userError } = await supabase
        .rpc('get_user_id_by_email', { email_input: email })
        .single();

      if (userError) throw userError;
      if (!data?.id) throw new Error('User not found with email: ' + email);

      const { data: cleaner, error } = await supabase
        .from('property_cleaners')
        .insert({
          property_id: propertyId,
          user_id: data.id,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return cleaner;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to add cleaner');
    }
  }

  async removeCleaner(cleanerId) {
    try {
      const { error } = await supabase
        .from('property_cleaners')
        .delete()
        .eq('id', cleanerId);

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to remove cleaner');
    }
  }
}