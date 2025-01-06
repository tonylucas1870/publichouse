import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class PropertyAccessService {
  async getPropertyAccess(propertyId) {
    try {
      const { data, error } = await supabase
        .from('property_access_details')
        .select('*')
        .eq('property_id', propertyId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load property access');
    }
  }

  async manageAccess(propertyId, userEmail, accessLevel) {
    try {
      const { error } = await supabase
        .rpc('manage_property_access', {
          property_id_input: propertyId,
          email_input: userEmail,
          level_input: accessLevel
        }); 

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update property access');
    }
  }

  async removeAccess(propertyId, userEmail) {
    try {
      // First get the user ID
      const { data: userData, error: userError } = await supabase
        .rpc('get_user_id_by_email', {
          email_input: userEmail
        });

      if (userError) throw userError;
      if (!userData?.id) throw new Error('User not found');

      // Then remove the access
      const { error } = await supabase
        .from('property_access')
        .delete()
        .eq('property_id', propertyId)
        .eq('user_id', userData.id);

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to remove property access');
    }
  }
}