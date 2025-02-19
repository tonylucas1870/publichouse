import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { CalendarService } from './CalendarService.js';
import { AirbnbService } from './AirbnbService.js';
import { getAirbnbListingUrl } from '../utils/calendarUtils.js';
import { showErrorAlert } from '../utils/alertUtils.js';

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

      // Transform null addresses to empty strings
      return (data || []).map(property => ({
        ...property,
        address: property.address || ''
      }));
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load properties');
    }
  }

  async createProperty(formData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to create properties');
      if (!formData.name?.trim()) throw new Error('Property name is required');

      // Create property
      const { data, error } = await supabase
        .from('properties')
        .insert({
          name: formData.name.trim(),
          address: formData.address || null,
          calendar_url: formData.calendar_url || null,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      // If calendar URL provided, trigger sync
      if (data && formData.calendar_url) {
        // Check if it's an Airbnb URL
        const isAirbnb = getAirbnbListingUrl(formData.calendar_url);
        
        try {
          if (isAirbnb) {
            console.debug('PropertyService: Processing Airbnb property', {
              propertyId: data.id,
              url: formData.calendar_url
            });
            
            // Initialize Airbnb service
            const airbnbService = new AirbnbService();
            airbnbService.setPropertyId(data.id);
            
            // Get listing details
            const listingDetails = await airbnbService.getListingDetails(formData.calendar_url);
            
            // Analyze listing data
            const analysis = await airbnbService.analyzeListingData(listingDetails);
            
            // Import rooms and contents
            await airbnbService.importRoomsAndContents(data.id, analysis);
            
            showErrorAlert('Property created and Airbnb data imported successfully', 'success');
          }
          
          // Sync calendar regardless of Airbnb status
          const calendarService = new CalendarService();
          const bookings = await calendarService.fetchCalendarData(formData.calendar_url);
          await calendarService.syncPropertyCalendar(data.id, bookings);
          
          if (!isAirbnb) {
            showErrorAlert('Property created and calendar synced successfully', 'success');
          }
        } catch (syncError) {
          console.error('Error syncing calendar:', syncError);
          showErrorAlert('Property created but calendar sync failed. You can retry sync later.');
        }
      }

      return data;
    } catch (error) {
      console.error('PropertyService error:', error.message || error);
      throw handleSupabaseError(error, 'Failed to create property');
    }
  }

  async getProperty(id) {
    try {
      if (!id) {
        throw new Error('No property ID provided');
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please sign in to view property details');
      }

      // Get property details
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id);

      if (propertyError) {
        console.error('PropertyService: Database error:', propertyError);
        throw new Error('Failed to load property details');
      }
      
      // Check if property exists and user has access
      const userProperty = property?.find(p => p.created_by === user.id);
      if (!userProperty) {
        throw new Error('Property not found or access denied');
      }

      // Transform null address to empty string
      userProperty.address = userProperty.address || '';

      return { data: userProperty, isAdmin: true }; // Owner always has admin rights
    } catch (error) {
      console.error('PropertyService error:', error);
      throw handleSupabaseError(error, error.message || 'Failed to load property details');
    }
  }

  async updateProperty(id, updates) {
    try {
      if (!id) throw new Error('Property ID is required');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to update properties');

      // Check if calendar URL is being updated to an Airbnb URL
      if (updates.calendar_url) {
        const isAirbnb = getAirbnbListingUrl(updates.calendar_url);
        if (isAirbnb) {
          try {
            console.debug('PropertyService: Processing Airbnb property update', {
              propertyId: id,
              url: updates.calendar_url
            });
            
            // Initialize Airbnb service
            const airbnbService = new AirbnbService();
            airbnbService.setPropertyId(id);
            
            // Get listing details
            const listingDetails = await airbnbService.getListingDetails(updates.calendar_url);
            
            // Analyze listing data
            const analysis = await airbnbService.analyzeListingData(listingDetails);
            
            // Import rooms and contents
            await airbnbService.importRoomsAndContents(id, analysis);
          } catch (airbnbError) {
            console.error('Error processing Airbnb data:', airbnbError);
            showErrorAlert('Property updated but Airbnb data import failed. You can retry later.');
          }
        }
      }
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