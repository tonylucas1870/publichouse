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
}