import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class NotificationService {
  async getPreferences() {
    try {
      const { data, error } = await supabase
        .from('user_settings') 
        .select('notification_preferences, display_name');

      if (error) throw error;
      return data?.[0] || { notification_preferences: {}, display_name: null };
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load notification preferences');
    }
  }

  async updateDisplayName(displayName) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // First try to update existing settings
      let { error } = await supabase
        .from('user_settings')
        .update({
          user_id: user.id,
          display_name: displayName || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      // If no record exists, insert a new one
      if (error?.code === 'PGRST116') {
        ({ error } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            display_name: displayName || null
          }));
      }

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update display name');
    }
  }

  async updatePreference(type, enabled) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Get current preferences
      const { data: current } = await supabase
        .from('user_settings')
        .select('notification_preferences')
        .single();

      // Merge new preference with existing ones
      const preferences = {
        ...(current?.notification_preferences || {}),
        [type]: enabled
      };

      // First try to update existing preference
      let { data, error } = await supabase
        .from('user_settings')
        .update({
          notification_preferences: preferences
        })
        .eq('user_id', user.id)
        .select()
        .single();

      // If no existing preference, insert new one
      if (error?.code === 'PGRST116') {
        ({ data, error } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            notification_preferences: preferences
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