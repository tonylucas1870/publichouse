import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class PropertyTaskService {
  async getTasks(propertyId) {
    try {
      const { data, error } = await supabase
        .from('property_tasks')
        .select('*')
        .eq('property_id', propertyId)
        .order('title');

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load property tasks');
    }
  }

  async addTask({ propertyId, title, description, location }) {
    try {
      const { data, error } = await supabase
        .from('property_tasks')
        .insert({
          property_id: propertyId,
          title,
          description,
          location
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to add task');
    }
  }

  async updateTask(taskId, { title, description, location }) {
    try {
      const { data, error } = await supabase
        .from('property_tasks')
        .update({
          title,
          description,
          location
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update task');
    }
  }

  async deleteTask(taskId) {
    try {
      const { error } = await supabase
        .from('property_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to delete task');
    }
  }
}