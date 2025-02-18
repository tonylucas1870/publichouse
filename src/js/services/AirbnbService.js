import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { getAirbnbListingUrl } from '../utils/calendarUtils.js';

export class AirbnbService {
  async getListingDetails(calendarUrl) {
    try {
      // Get listing URL from calendar URL
      const listingUrl = getAirbnbListingUrl(calendarUrl);
      if (!listingUrl) {
        throw new Error('Not a valid Airbnb calendar URL');
      }

      // Call Supabase Edge Function to fetch listing details
      const { data, error } = await supabase.functions.invoke('fetch-airbnb', {
        body: { url: listingUrl }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching Airbnb listing:', error);
      throw handleSupabaseError(error, 'Failed to fetch Airbnb listing details');
    }
  }

  async analyzeListingData(listingData) {
    try {
      // Call Supabase Edge Function to analyze listing
      const { data, error } = await supabase.functions.invoke('analyze-airbnb', {
        body: { 
          listingData,
          propertyId: this.propertyId
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error analyzing Airbnb listing:', error);
      throw handleSupabaseError(error, 'Failed to analyze listing data');
    }
  }

  async importRoomsAndContents(propertyId, analysisResult) {
    try {
      // Create rooms and contents from analysis
      for (const room of analysisResult.rooms) {
        let roomId;

        if (room.isNew) {
          // Create new room
          const { data: newRoom, error: roomError } = await supabase
            .from('rooms')
            .insert({
              property_id: propertyId,
              name: room.name
            })
            .select()
            .single();

          if (roomError) throw roomError;
          roomId = newRoom.id;
        } else if (room.hasNewContents) {
          // Get existing room ID
          const { data: existingRoom, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('property_id', propertyId)
            .eq('name', room.name)
            .single();

          if (roomError) throw roomError;
          roomId = existingRoom.id;
        }

        if (roomId) {
          // Get existing contents
          const { data: roomDetails, error: detailsError } = await supabase
            .from('room_details')
            .select('contents')
            .eq('room_id', roomId)
            .single();

          if (detailsError) throw detailsError;

          // Merge existing and new contents
          const existingContents = roomDetails?.contents || [];
          const newContents = room.contents.filter(newItem => 
            !existingContents.some(existingItem => 
              existingItem.name.toLowerCase() === newItem.name.toLowerCase()
            )
          ).map(item => ({
            id: crypto.randomUUID(),
            name: item.name,
            description: item.description,
            images: []
          }));

          // Update room details with merged contents
          const { error: updateError } = await supabase
            .from('room_details')
            .update({
              contents: [...existingContents, ...newContents]
            })
            .eq('room_id', roomId);

          if (updateError) throw updateError;
        }
      }
    } catch (error) {
      console.error('Error importing rooms and contents:', error);
      throw handleSupabaseError(error, 'Failed to import rooms and contents');
    }
  }
}