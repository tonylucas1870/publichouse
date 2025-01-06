import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

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

      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load properties');
    }
  }

  async createProperty(formData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please sign in to create properties');
      }

      const { data, error } = await supabase
        .from('properties')
        .insert({
          name: formData.name.trim(),
          address: formData.address.trim(),
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('PropertyService error:', error);
      throw handleSupabaseError(error, 'Failed to create property');
    }
  }

  async getProperty(id) {
    try {
      if (!id) throw new Error('Property ID is required');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Get property details
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .eq('created_by', user.id)
        .single();

      if (propertyError) throw propertyError;
      if (!property) throw new Error('Property not found');

      return { data: property, isAdmin: true }; // Owner always has admin rights
    } catch (error) {
      console.error('PropertyService error:', error);
      throw handleSupabaseError(error, 'Failed to load property');
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