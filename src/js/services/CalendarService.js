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
      bookingsCount: bookings.length,
      firstBooking: bookings[0] ? {
        uid: bookings[0].uid,
        start: bookings[0].start,
        end: bookings[0].end
      } : null
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      DebugLogger.log('CalendarService', 'Auth check', { 
        hasUser: !!user,
        userId: user?.id 
      });

      if (!user) {
        throw new Error('Authentication required');
      }

      // Update property sync status to pending
      const { error: statusError } = await supabase
        .from('properties')
        .update({
          calendar_sync_status: 'pending',
          calendar_sync_error: null
        })
        .eq('id', propertyId)
        .eq('created_by', user.id);

      if (statusError) {
        DebugLogger.error('CalendarService', 'Failed to update sync status', statusError);
      }

      // Process each booking
      for (const booking of bookings) {
        DebugLogger.log('CalendarService', 'Processing booking', {
          uid: booking.uid,
          start: booking.start,
          end: booking.end
        });

        try {
          // Check for existing booking
          const { data: existing, error: checkError } = await supabase
            .from('changeovers')
            .select('id')
            .eq('calendar_booking_id', booking.uid)
            .maybeSingle();

          if (checkError) {
            DebugLogger.error('CalendarService', 'Error checking existing booking', {
              error: checkError,
              bookingId: booking.uid
            });
            continue;
          }

          DebugLogger.log('CalendarService', 'Existing booking check', {
            bookingId: booking.uid,
            exists: !!existing,
            existingId: existing?.id
          });

          // Only create if no existing booking found
          if (!existing) {
            const { error: insertError } = await supabase
              .from('changeovers')
              .insert({
                property_id: propertyId,
                checkin_date: booking.start.toISOString().split('T')[0],
                checkout_date: booking.end.toISOString().split('T')[0],
                calendar_booking_id: booking.uid,
                created_by: user.id
              });

            if (insertError) {
              DebugLogger.error('CalendarService', 'Failed to insert changeover', {
                error: insertError,
                booking: {
                  uid: booking.uid,
                  start: booking.start,
                  end: booking.end
                }
              });
              throw insertError;
            }

            DebugLogger.log('CalendarService', 'Created new changeover', {
              bookingId: booking.uid
            });
          }
        } catch (bookingError) {
          DebugLogger.error('CalendarService', `Error processing booking ${booking.uid}`, bookingError);
          continue;
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

      // Mark initial sync as complete
      const { error: syncFlagError } = await supabase
        .from('properties')
        .update({
          initial_sync_complete: true
        })
        .eq('id', propertyId)
        .eq('created_by', user.id);

      if (syncFlagError) {
        DebugLogger.error('CalendarService', 'Failed to update initial sync flag', syncFlagError);
      }

      DebugLogger.log('CalendarService', 'Calendar sync completed successfully');
    } catch (error) {
      DebugLogger.error('CalendarService', 'Calendar sync failed', { 
        error,
        context: {
          propertyId,
          bookingsCount: bookings.length,
          lastQuery: error.query, // Supabase sometimes includes the failing query
          pgError: error.pgError, // PostgreSQL specific error details
          details: error.details,
          hint: error.hint,
          where: error.where,
          position: error.position,
          schema: error.schema,
          table: error.table,
          column: error.column,
          dataType: error.dataType,
          constraint: error.constraint,
          stack: error.stack // Include stack trace
        }
      });

      // Update sync status to failed
      const { error: statusError } = await supabase
        .from('properties')
        .update({
          calendar_sync_status: 'failed',
          calendar_sync_error: error.message
        })
        .eq('id', propertyId);

      if (statusError) {
        DebugLogger.error('CalendarService', 'Failed to update error status', statusError);
      }

      throw handleSupabaseError(error, 'Failed to sync calendar');
    }
  }
}