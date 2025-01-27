import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class NotificationService {
  async getPreferences() {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .order('notification_type');

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load notification preferences');
    }
  }

  async updatePreference(notificationType, enabled) {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ enabled })
        .eq('notification_type', notificationType);

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update notification preference');
    }
  }
}