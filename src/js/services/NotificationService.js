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

  async updatePreference(type, enabled) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // First try to update existing preference
      let { data, error } = await supabase
        .from('notification_preferences')
        .update({
          enabled
        })
        .eq('user_id', user.id)
        .eq('notification_type', type)
        .select()
        .single();

      // If no existing preference, insert new one
      if (error?.code === 'PGRST116') {
        ({ data, error } = await supabase
          .from('notification_preferences')
          .insert({
          user_id: user.id,
          notification_type: type,
          enabled
          })
          .select()
          .single()
        );
      }

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update notification preference');
    }
  }

  async updatePassword(currentPassword, newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update password');
    }
  }
}