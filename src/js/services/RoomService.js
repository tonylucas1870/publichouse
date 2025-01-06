import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class RoomService {
  async getRooms(id, isChangeoverId = false) {
    try {
      console.debug('RoomService: Getting rooms', { id, isChangeoverId });

      let propertyId = id;

      // If this is a changeover ID, get the property ID first
      if (isChangeoverId) {
        console.debug('RoomService: Getting property ID from changeover');
        const { data: changeover, error: changeoverError } = await supabase
          .from('changeovers')
          .select(`
            id,
            property_id,
            property:properties (
              id,
              name,
              created_by
            )
          `)
          .eq('id', id)
          .single();

        if (changeoverError) {
          console.error('RoomService: Error getting changeover', changeoverError);
          throw changeoverError;
        }

        if (!changeover?.property_id) {
          console.error('RoomService: No property ID found for changeover');
          throw new Error('Property not found');
        }

        propertyId = changeover.property_id;
        console.debug('RoomService: Got property ID from changeover', { propertyId });
      }

      // Get rooms for the property
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('property_id', propertyId)
        .order('name');

      if (roomsError) {
        console.error('RoomService: Error getting rooms', roomsError);
        throw roomsError;
      }

      console.debug('RoomService: Got rooms', { 
        count: rooms?.length,
        rooms: rooms?.map(r => r.name)
      });

      return rooms || [];
    } catch (error) {
      console.error('RoomService: Error in getRooms', error);
      throw handleSupabaseError(error, 'Failed to load rooms');
    }
  }

  async addRoom(propertyId, name) {
    try {
      console.debug('RoomService: Adding room', { propertyId, name });

      const { data, error } = await supabase
        .from('rooms')
        .insert({ property_id: propertyId, name })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          console.debug('RoomService: Room already exists', { name });
          return; // Room already exists
        }
        console.error('RoomService: Error adding room', error);
        throw handleSupabaseError(error);
      }

      console.debug('RoomService: Room added successfully', data);
      return data;
    } catch (error) {
      console.error('RoomService: Error in addRoom', error);
      throw handleSupabaseError(error, 'Failed to add room');
    }
  }

  async deleteRoom(propertyId, roomId) {
    try {
      console.debug('RoomService: Deleting room', { propertyId, roomId });

      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('property_id', propertyId)
        .eq('id', roomId);

      if (error) {
        console.error('RoomService: Error deleting room', error);
        throw handleSupabaseError(error);
      }

      console.debug('RoomService: Room deleted successfully');
    } catch (error) {
      console.error('RoomService: Error in deleteRoom', error);
      throw handleSupabaseError(error, 'Failed to delete room');
    }
  }
}