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
}