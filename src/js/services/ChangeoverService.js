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
          status,
          share_token,
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
          status,
          share_token,
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

      // Check access - allow if shared or if user owns the property
      if (!data.share_token && (!user || user.id !== data.property?.created_by)) {
        throw new Error('Access denied');
      }

      return data;
    } catch (error) {
      console.error('ChangeoverService error:', error);
      throw handleSupabaseError(error, error.message || 'Failed to load changeover');
    }
  }

  async getChangeoverByToken(token) {
    try {
      if (!token) {
        throw new Error('No share token provided');
      }

      const { data, error } = await supabase
        .from('changeovers')
        .select(`
          id,
          checkin_date,
          checkout_date,
          status,
          share_token,
          property:properties (
            id,
            name,
            address,
            created_by,
            calendar_url,
            calendar_sync_status,
            calendar_last_synced,
            calendar_sync_error
          )
        `)
        .eq('share_token', token)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Changeover not found');

      return data;
    } catch (error) {
      console.error('ChangeoverService error:', error);
      throw handleSupabaseError(error, error.message || 'Failed to load shared changeover');
    }
  }
  async getProperties() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('properties')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load properties');
    }
  }

  async updateStatus(changeoverId, status) {
    try {
      const { data, error } = await supabase
        .rpc('update_changeover_status', {
          changeover_id_input: changeoverId,
          new_status: status
        });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update changeover status');
    }
  }

  async createChangeover({ propertyId, checkinDate, checkoutDate }) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('changeovers')
        .insert({
          property_id: propertyId,
          checkin_date: checkinDate,
          checkout_date: checkoutDate,
          status: 'scheduled',
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to create changeover');
    }
  }
}