import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class PropertyTaskService {
  async getTasks(propertyId) {
    try {
      console.debug('PropertyTaskService: Getting tasks', { propertyId });

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

      if (error) {
        console.error('PropertyTaskService: Error getting tasks', error);
        throw error;
      }

      console.debug('PropertyTaskService: Got tasks', { 
        count: data?.length,
        tasks: data?.map(t => ({ id: t.id, title: t.title }))
      });

      return data || [];
    } catch (error) {
      console.error('PropertyTaskService: Error in getTasks', error);
      throw handleSupabaseError(error, 'Failed to load property tasks');
    }
  }

  async addTask({ propertyId, title, description, location, scheduling_type, interval, images }) {
    try {
      console.debug('PropertyTaskService: Adding task', { 
        propertyId, 
        title, 
        location,
        scheduling_type,
        interval,
        imageCount: images?.length 
      });

      const { data, error } = await supabase
        .from('property_tasks')
        .insert({
          property_id: propertyId,
          title,
          description,
          location,
          scheduling_type: scheduling_type || null,
          interval: interval || null,
          images: images || []
        })
        .select()
        .single();

      if (error) {
        console.error('PropertyTaskService: Error adding task', error);
        throw error;
      }

      console.debug('PropertyTaskService: Task added successfully', data);
      return data;
    } catch (error) {
      console.error('PropertyTaskService: Error in addTask', error);
      throw handleSupabaseError(error, 'Failed to add task');
    }
  }

  async updateTask(taskId, { title, description, location }) {
    try {
      console.debug('PropertyTaskService: Updating task', { taskId, title, location });

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

      if (error) {
        console.error('PropertyTaskService: Error updating task', error);
        throw error;
      }

      console.debug('PropertyTaskService: Task updated successfully', data);
      return data;
    } catch (error) {
      console.error('PropertyTaskService: Error in updateTask', error);
      throw handleSupabaseError(error, 'Failed to update task');
    }
  }

  async updateTaskImages(taskId, images) {
    try {
      console.debug('PropertyTaskService: Updating task images', { 
        taskId, 
        imageCount: images?.length 
      });

      const { data, error } = await supabase
        .from('property_tasks')
        .update({ 
          images: Array.isArray(images) ? images : []
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('PropertyTaskService: Error updating task images', error);
        throw error;
      }

      console.debug('PropertyTaskService: Task images updated successfully', { 
        taskId, 
        imageCount: data.images?.length 
      });
      return data;
    } catch (error) {
      console.error('PropertyTaskService: Error updating task images', error);
      throw handleSupabaseError(error, 'Failed to update task images');
    }
  }

  async updateTaskScheduling(taskId, { scheduling_type, interval }) {
    try {
      console.debug('PropertyTaskService: Updating task scheduling', {
        taskId,
        scheduling_type,
        interval
      });

      const { data, error } = await supabase
        .from('property_tasks')
        .update({
          scheduling_type: scheduling_type || null,
          interval: interval || null
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('PropertyTaskService: Error updating task scheduling', error);
        throw error;
      }

      console.debug('PropertyTaskService: Task scheduling updated successfully', data);
      return data;
    } catch (error) {
      console.error('PropertyTaskService: Error updating task scheduling', error);
      throw handleSupabaseError(error, 'Failed to update task scheduling');
    }
  }

  async deleteTask(taskId) {
    try {
      console.debug('PropertyTaskService: Deleting task', { taskId });

      const { error } = await supabase
        .from('property_tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('PropertyTaskService: Error deleting task', error);
        throw error;
      }

      console.debug('PropertyTaskService: Task deleted successfully');
    } catch (error) {
      console.error('PropertyTaskService: Error in deleteTask', error);
      throw handleSupabaseError(error, 'Failed to delete task');
    }
  }
}