import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class TaskService {
  async getTasks(propertyId) {
    try {
      const { data, error } = await supabase
        .from('property_tasks')
        .select(`
          id,
          title,
          description,
          location,
          scheduling_type,
          interval,
          last_executed,
          images
        `)
        .eq('property_id', propertyId)
        .order('title');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading tasks:', error);
      throw handleSupabaseError(error, 'Failed to load tasks');
    }
  }

  async addTask({ propertyId, title, description, location, scheduling_type, interval, images = [] }) {
    try {
      const { data, error } = await supabase
        .from('property_tasks')
        .insert({
          property_id: propertyId,
          title,
          description,
          location,
          scheduling_type,
          interval,
          images
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

  async updateTaskImages(taskId, images) {
    try {
      const { data, error } = await supabase
        .from('property_tasks')
        .update({ images })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update task images');
    }
  }

  async updateTaskScheduling(taskId, { scheduling_type, interval }) {
    try {
      const { data, error } = await supabase
        .from('property_tasks')
        .update({
          scheduling_type,
          interval
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update task scheduling');
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