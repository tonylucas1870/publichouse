import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class ICalFeedService {
  /**
   * Get the iCal feed URL for a specific property
   * @param {string} propertyId - ID of the property
   * @returns {Promise<string>} Feed URL
   */
  async getPropertyFeedUrl(propertyId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Get or create feed token
      const { data: feedAccess } = await supabase
        .from('ical_feed_access')
        .select('token')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .single();

      if (feedAccess) {
        return this._generateFeedUrl(user.id, propertyId, feedAccess.token);
      }

      // Create new feed token
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from('ical_feed_access')
        .insert({
          user_id: user.id,
          property_id: propertyId,
          token
        });

      if (error) throw error;
      return this._generateFeedUrl(user.id, propertyId, token);
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Get the iCal feed URL for all properties
   * @returns {Promise<string>} Feed URL
   */
  async getAllPropertiesFeedUrl() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Get or create feed token
      const { data: feedAccess } = await supabase
        .from('ical_feed_access')
        .select('token')
        .eq('user_id', user.id)
        .is('property_id', null)
        .maybeSingle();

      if (feedAccess) {
        return this._generateFeedUrl(user.id, null, feedAccess.token);
      }

      // Create new feed token
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from('ical_feed_access')
        .insert({
          user_id: user.id,
          property_id: null,
          token
        });

      if (error) throw error;
      return this._generateFeedUrl(user.id, null, token);
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Generate the feed URL
   * @private
   */
  _generateFeedUrl(userId, propertyId, token) {
    const baseUrl = window.location.origin;
    const url = new URL('/functions/serve-ical', baseUrl);
    url.searchParams.set('userId', userId);
    if (propertyId) url.searchParams.set('propertyId', propertyId);
    url.searchParams.set('token', token);
    return url.toString();
  }
}
