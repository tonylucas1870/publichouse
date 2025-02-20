import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { getAirbnbListingUrl } from '../utils/calendarUtils.js';

// Validation schema for room content items
const validateContentItem = (item) => {
  const requiredFields = ['name', 'category', 'quantity', 'is_new', 'recognized_by'];
  const validCategories = ['furniture', 'appliance', 'fixture', 'other'];
  
  // Check required fields
  for (const field of requiredFields) {
    if (!(field in item)) {
      throw new Error(`Content item missing required field: ${field}`);
    }
  }
  
  // Validate category
  if (!validCategories.includes(item.category)) {
    throw new Error(`Invalid category "${item.category}". Must be one of: ${validCategories.join(', ')}`);
  }
  
  // Validate quantity
  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    throw new Error('Quantity must be a positive integer');
  }
  
  // Validate recognition source
  if (!['image', 'description'].includes(item.recognized_by)) {
    throw new Error('recognized_by must be either "image" or "description"');
  }
};

// Validation schema for rooms
const validateRoom = (room) => {
  const requiredFields = ['name', 'contents', 'isNew'];
  
  // Check required fields
  for (const field of requiredFields) {
    if (!(field in room)) {
      throw new Error(`Room missing required field: ${field}`);
    }
  }
  
  // Validate contents array
  if (!Array.isArray(room.contents)) {
    throw new Error('Room contents must be an array');
  }
  
  // Validate each content item
  //Disabled for now
  //room.contents.forEach(validateContentItem);
};

export class AirbnbService {
  constructor() {
    this.propertyId = null;
  }

  setPropertyId(id) {
    if (!id) {
      throw new Error('Property ID is required');
    }
    this.propertyId = id;
  }

  async getListingDetails(calendarUrl) {
    try {
      // Get listing URL from calendar URL
      const listingUrl = getAirbnbListingUrl(calendarUrl);
      if (!listingUrl) {
        throw new Error('Not a valid Airbnb calendar URL');
      }

      console.debug('AirbnbService: Getting listing details', { listingUrl });

      // Call Supabase Edge Function to fetch listing details
      const { data, error } = await supabase.functions.invoke('fetch-airbnb', {
        body: { url: listingUrl }
      });

      if (error) throw error;
      
      console.debug('AirbnbService: Got listing details', {
        id: data.id,
        name: data.name,
        imageCount: data.images?.length
      });
      
      return data;
    } catch (error) {
      console.error('Error fetching Airbnb listing:', error);
      throw handleSupabaseError(error, 'Failed to fetch Airbnb listing details');
    }
  }

  async analyzeListingData(listingData) {
    try {
      if (!this.propertyId) {
        throw new Error('Property ID not set. Call setPropertyId() first');
      }

      console.debug('AirbnbService: Analyzing listing data', {
        id: listingData.id,
        name: listingData.name,
        propertyId: this.propertyId
      });

      // Call Supabase Edge Function to analyze listing
      const { data, error } = await supabase.functions.invoke('analyze-airbnb', {
        body: { 
          listingData: listingData,
          propertyId: this.propertyId
        }
      });

      if (error) throw error;
      if (!data) {
        throw new Error('No analysis results returned');
      }

      // Validate response format
      if (!data.property || !Array.isArray(data.rooms)) {
        throw new Error('Invalid analysis response format');
      }

      // Validate each room
      data.rooms.forEach(validateRoom);

      console.debug('AirbnbService: Analysis complete', {
        propertyId: data.property,
        roomCount: data.rooms.length,
        newRooms: data.rooms.filter(r => r.isNew).length
      });

      return data;
    } catch (error) {
      console.error('Error analyzing Airbnb listing:', error);
      throw handleSupabaseError(error, 'Failed to analyze listing data');
    }
  }

  async importRoomsAndContents(propertyId, analysisResult) {
    try {
      console.debug('AirbnbService: Importing rooms and contents', {
        propertyId,
        roomCount: analysisResult.rooms.length
      });

      // Validate property ID
      if (!propertyId) {
        throw new Error('Property ID is required');
      }

      // Validate analysis result
      if (!analysisResult?.rooms || !Array.isArray(analysisResult.rooms)) {
        throw new Error('Invalid analysis result format');
      }

      // Create rooms and contents from analysis
      for (const room of analysisResult.rooms) {
        console.debug('AirbnbService: Processing room', {
          name: room.name,
          isNew: room.isNew,
          contentCount: room.contents.length
        });

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
          
          console.debug('AirbnbService: Created new room', {
            id: roomId,
            name: room.name
          });
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
          
          console.debug('AirbnbService: Found existing room', {
            id: roomId,
            name: room.name
          });
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
          const newContents = room.contents
            .filter(newItem => !existingContents.some(existingItem => 
              existingItem.name.toLowerCase() === newItem.name.toLowerCase()
            ))
            .map(item => ({
              id: crypto.randomUUID(),
              name: item.name,
              description: item.quantity > 1 ? 
                `${item.name} (Quantity: ${item.quantity})` : item.name,
              category: item.category,
              quantity: item.quantity,
              source: item.recognized_by,
              images: []
            }));

          console.debug('AirbnbService: Updating room contents', {
            roomId,
            existingCount: existingContents.length,
            newCount: newContents.length
          });

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

      console.debug('AirbnbService: Import complete');
    } catch (error) {
      console.error('Error importing rooms and contents:', error);
      throw handleSupabaseError(error, 'Failed to import rooms and contents');
    }
  }
}