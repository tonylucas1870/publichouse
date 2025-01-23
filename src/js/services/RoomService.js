import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class RoomService { 
  async getRooms(propertyId) {
    try {
      if (!propertyId) {
        throw new Error('Property ID is required');
      }

      let actualPropertyId = propertyId;
      let isSharedAccess = false;

      try {
        // Try to get changeover first
        const { data: changeover } = await supabase
          .from('changeovers')
          .select('property_id, share_token')
          .eq('id', propertyId)
          .maybeSingle();

        // If we found a changeover, use its property ID
        if (changeover) {
          actualPropertyId = changeover.property_id;
          isSharedAccess = !!changeover.share_token;
        } else {
          // Not a changeover ID, try to verify it's a valid property ID
          const { data: property } = await supabase
            .from('properties')
            .select('id')
            .eq('id', propertyId)
            .maybeSingle();
            
          if (!property) {
            throw new Error('Invalid property or changeover ID');
          }
        }
      } catch (error) {
        console.error('RoomService: Error checking ID type:', error);
        throw new Error('Invalid property or changeover ID');
      }

      // Store shared access state
      this.isSharedAccess = isSharedAccess;

      // Get rooms for the property
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('property_id', actualPropertyId)
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
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please sign in to create rooms');
      }
      
      let actualPropertyId = propertyId;

      // Check if this is a changeover ID
      const { data: changeover } = await supabase
        .from('changeovers')
        .select('property_id')
        .eq('id', propertyId)
        .maybeSingle();

      if (changeover) {
        actualPropertyId = changeover.property_id;
      }

      // Verify property access
      const { data: property } = await supabase
        .from('properties')
        .select('id')
        .eq('id', actualPropertyId)
        .maybeSingle();

      if (!property) {
        throw new Error('Invalid property ID');
      }

      if (!name || !name.trim()) {
        throw new Error('Room name is required');
      }

      // First check if room already exists
      const { data: existingRooms, error: checkError } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('property_id', actualPropertyId);

      if (checkError) {
        console.error('RoomService: Error checking existing room', checkError);
        throw handleSupabaseError(checkError);
      }

      // Case-insensitive name check
      const normalizedName = name.trim().toLowerCase();
      const existingRoom = existingRooms?.find(room => 
        room.name.toLowerCase() === normalizedName
      );

      if (existingRoom) {
        console.debug('RoomService: Room already exists', existingRooms[0]);
        return existingRoom;
      }

      // Create new room
      const { data: newRoom, error: createError } = await supabase
        .from('rooms')
        .insert({
          property_id: actualPropertyId,
          name: name.trim() 
        })
        .select()
        .single();

      if (createError) {
        console.error('RoomService: Error creating room', createError);
        throw handleSupabaseError(createError);
      }

      console.debug('RoomService: Room created successfully', newRoom);
      return newRoom;
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