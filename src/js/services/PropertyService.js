import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { CalendarService } from './CalendarService.js';
import { showErrorAlert } from '../utils/alertUtils.js';

export class PropertyService {
  async getProperties() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('created_by', user.id);

      if (error) throw error;

      // Transform null addresses to empty strings
      return (data || []).map(property => ({
        ...property,
        address: property.address || ''
      }));
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load properties');
    }
  }

  async createProperty(formData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to create properties');
      if (!formData.name?.trim()) throw new Error('Property name is required');

      // Create property
      const { data, error } = await supabase
        .from('properties')
        .insert({
          name: formData.name.trim(),
          address: formData.address || null,
          calendar_url: formData.calendar_url || null,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      // If calendar URL provided, trigger sync
      if (data && formData.calendar_url) {
        try {
          const calendarService = new CalendarService();
          const bookings = await calendarService.fetchCalendarData(formData.calendar_url);
          await calendarService.syncPropertyCalendar(data.id, bookings);
          showErrorAlert('Property created and calendar synced successfully', 'success');
        } catch (syncError) {
          console.error('Error syncing calendar:', syncError);
          showErrorAlert('Property created but calendar sync failed. You can retry sync later.');
        }
      }

      return data;
    } catch (error) {
      console.error('PropertyService error:', error.message || error);
      throw handleSupabaseError(error, 'Failed to create property');
    }
  }

  async getProperty(id) {
    try {
      if (!id) {
        throw new Error('No property ID provided');
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please sign in to view property details');
      }

      // Get property details
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id);

      if (propertyError) {
        console.error('PropertyService: Database error:', propertyError);
        throw new Error('Failed to load property details');
      }
      
      // Check if property exists and user has access
      const userProperty = property?.find(p => p.created_by === user.id);
      if (!userProperty) {
        throw new Error('Property not found or access denied');
      }

      // Transform null address to empty string
      userProperty.address = userProperty.address || '';

      return { data: userProperty, isAdmin: true }; // Owner always has admin rights
    } catch (error) {
      console.error('PropertyService error:', error);
      throw handleSupabaseError(error, error.message || 'Failed to load property details');
    }
  }

  async updateProperty(id, updates) {
    try {
      if (!id) throw new Error('Property ID is required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to update properties');

      const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
        .eq('created_by', user.id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Property not found or access denied');

      return data;
    } catch (error) {
      console.error('PropertyService error:', error);
      throw handleSupabaseError(error, 'Failed to update property');
    }
  }
}