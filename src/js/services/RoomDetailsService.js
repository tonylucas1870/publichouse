import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class RoomDetailsService {
  async getRoomDetails(roomId) {
    try {
      if (!roomId) throw new Error('Room ID is required');

      const { data, error } = await supabase
        .from('room_details')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();

      if (error) throw handleSupabaseError(error);

      // If no details exist, return default structure
      if (!data) {
        return {
          room_id: roomId,
          contents: [],
          walls: [],
          lighting: []
        };
      }

      // Ensure arrays exist and are properly initialized
      return {
        ...data,
        contents: Array.isArray(data.contents) ? data.contents : [],
        walls: Array.isArray(data.walls) ? data.walls : [],
        lighting: Array.isArray(data.lighting) ? data.lighting : []
      };
    } catch (error) {
      console.error('RoomDetailsService error:', error);
      throw handleSupabaseError(error, 'Failed to load room details');
    }
  }

  async updateRoomDetails(roomId, details) {
    try {
      if (!roomId) throw new Error('Room ID is required');

      // Ensure arrays are properly formatted
      const formattedDetails = {
        contents: Array.isArray(details.contents) ? details.contents : [],
        walls: Array.isArray(details.walls) ? details.walls : [],
        lighting: Array.isArray(details.lighting) ? details.lighting : []
      };

      // First check if details exist
      const { data: existing } = await supabase
        .from('room_details')
        .select('id')
        .eq('room_id', roomId)
        .maybeSingle();

      let result;
      
      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('room_details')
          .update({
            ...formattedDetails,
            updated_at: new Date().toISOString()
          })
          .eq('room_id', roomId)
          .select()
          .single();
          
        if (error) throw handleSupabaseError(error);
        result = data;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('room_details')
          .insert({
            room_id: roomId,
            ...formattedDetails
          })
          .select()
          .single();
          
        if (error) throw handleSupabaseError(error);
        result = data;
      }

      return result;
    } catch (error) {
      console.error('RoomDetailsService error:', error);
      throw handleSupabaseError(error, 'Failed to update room details');
    }
  }

  async addContentItem(roomId, contentItem) {
    try {
      // Get current room details
      const details = await this.getRoomDetails(roomId);

      // Check if item with same name already exists
      const existingItem = details.contents.find(item => 
        item.name.toLowerCase() === contentItem.name.toLowerCase()
      );

      if (existingItem) {
        return existingItem;
      }

      // Add new item to contents
      const updatedContents = [
        ...details.contents,
        {
          id: contentItem.id || crypto.randomUUID(),
          name: contentItem.name,
          description: contentItem.description || '',
          images: Array.isArray(contentItem.images) ? contentItem.images : []
        }
      ];

      // Sort contents alphabetically
      updatedContents.sort((a, b) => a.name.localeCompare(b.name));

      // Update room details
      const result = await this.updateRoomDetails(roomId, {
        ...details,
        contents: updatedContents
      });

      return result.contents.find(item => item.name === contentItem.name);
    } catch (error) {
      console.error('RoomDetailsService error:', error);
      throw handleSupabaseError(error, 'Failed to add content item');
    }
  }
}