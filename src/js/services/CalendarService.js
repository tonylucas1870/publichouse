import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { parseICS } from '../utils/calendarUtils.js';
import { DebugLogger } from '../utils/debugUtils.js';

export class CalendarService {
  async fetchCalendarData(url) {
    DebugLogger.log('CalendarService', 'Starting calendar fetch', { url });
    
    try {
      // Use a CORS proxy to fetch the ICS file
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      DebugLogger.log('CalendarService', 'Using proxy URL', { proxyUrl });

      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const icsData = await response.text();
      if (!icsData) {
        throw new Error('Empty response from calendar URL');
      }

      DebugLogger.log('CalendarService', 'Received calendar data', {
        dataLength: icsData.length,
        preview: icsData.substring(0, 100)
      });

      const bookings = parseICS(icsData);
      DebugLogger.log('CalendarService', 'Parsed bookings', {
        count: bookings.length
      });

      return bookings;
    } catch (error) {
      DebugLogger.error('CalendarService', 'Calendar fetch failed', error);
      throw new Error('Failed to fetch calendar data: ' + error.message);
    }
  }

  async syncPropertyCalendar(propertyId, bookings) {
    DebugLogger.log('CalendarService', 'Starting calendar sync', {
      propertyId,
      bookingsCount: bookings.length
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // Update property sync status to pending
      await supabase
        .from('properties')
        .update({
          calendar_sync_status: 'pending',
          calendar_sync_error: null
        })
        .eq('id', propertyId)
        .eq('created_by', user.id);

      // Process each booking
      for (const booking of bookings) {
        DebugLogger.log('CalendarService', 'Processing booking', {
          uid: booking.uid,
          start: booking.start,
          end: booking.end
        });

        const { data: existing, error: checkError } = await supabase
          .from('changeovers')
          .select('id')
          .eq('calendar_booking_id', booking.uid)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (!existing) {
          // Create new changeover
          const { error: insertError } = await supabase
            .from('changeovers')
            .insert({
              property_id: propertyId,
              checkin_date: booking.start.toISOString().split('T')[0],
              checkout_date: booking.end.toISOString().split('T')[0],
              calendar_booking_id: booking.uid,
              created_by: user.id
            });

          if (insertError) throw insertError;
        }
      }

      // Update sync status to success
      const { error: updateError } = await supabase
        .from('properties')
        .update({
          calendar_sync_status: 'synced',
          calendar_last_synced: new Date().toISOString(),
          calendar_sync_error: null
        })
        .eq('id', propertyId)
        .eq('created_by', user.id);

      if (updateError) throw updateError;

      DebugLogger.log('CalendarService', 'Calendar sync completed successfully');
    } catch (error) {
      DebugLogger.error('CalendarService', 'Calendar sync failed', error);

      // Update sync status to failed
      await supabase
        .from('properties')
        .update({
          calendar_sync_status: 'failed',
          calendar_sync_error: error.message
        })
        .eq('id', propertyId);

      throw handleSupabaseError(error, 'Failed to sync calendar');
    }
  }
}