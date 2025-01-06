import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class ChangeoverService {
  async getChangeovers(propertyIds = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Build query
      let query = supabase
        .from('changeovers')
        .select(`
          id,
          checkin_date,
          checkout_date,
          property:properties (
            id,
            name
          )
        `);

      // Apply filters
      if (propertyIds) {
        if (Array.isArray(propertyIds)) {
          query.in('property_id', propertyIds);
        } else {
          query.eq('property_id', propertyIds);
        }
      } else {
        // Show changeovers for owned properties
        const { data: ownedProperties } = await supabase
          .from('properties')
          .select('id')
          .eq('created_by', user.id);

        if (ownedProperties?.length) {
          query.in('property_id', ownedProperties.map(p => p.id));
        } else {
          // No owned properties, return empty result
          return [];
        }
      }

      // Execute query
      const { data, error } = await query.order('checkin_date');
      if (error) throw error;

      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load changeovers');
    }
  }

  async getChangeover(changeoverId) {
    try {
      if (!changeoverId) {
        throw new Error('No changeover ID provided');
      }

      // Get current user (if authenticated)
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('changeovers')
        .select(`
          id,
          checkin_date,
          checkout_date,
          property_id,
          property:properties (
            id,
            name,
            created_by
          )
        `)
        .eq('id', changeoverId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Changeover not found');

      // Check access - only allow if user owns the property
      if (!user || user.id !== data.property?.created_by) {
        throw new Error('Access denied');
      }

      return data;
    } catch (error) {
      console.error('ChangeoverService error:', error);
      throw handleSupabaseError(error, error.message || 'Failed to load changeover');
    }
  }
}