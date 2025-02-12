import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { parseICS } from '../utils/calendarUtils.js';
import { DebugLogger } from '../utils/debugUtils.js';

export class CalendarService {
  async fetchCalendarData(url) {
    DebugLogger.log('CalendarService', 'Starting calendar fetch', { url });
    
    try {
      // Fetch calendar data through Supabase function
      const { data, error } = await supabase.functions.invoke('fetch-calendar', {
        body: { url }
      });
      if (error) {
        throw error;
      }

      if (!data?.icsData) {
        throw new Error('Empty response from calendar URL');
      }

      DebugLogger.log('CalendarService', 'Received calendar data', {
        dataLength: data.icsData.length,
        preview: data.icsData.substring(0, 100)
      });

      const bookings = parseICS(data.icsData);
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
      bookingIds: bookings.map(b => b.uid)
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

      // Get all existing bookings for this property
      const { data: existingChangeovers, error: fetchError } = await supabase
        .from('changeovers')
        .select('id, calendar_booking_id, checkin_date, checkout_date')
        .eq('property_id', propertyId)
        .not('calendar_booking_id', 'is', null);

      if (fetchError) {
        DebugLogger.error('CalendarService', 'Error fetching existing changeovers', fetchError);
        throw fetchError;
      }

      // Create map of existing bookings by calendar ID
      const existingBookings = new Map(
        existingChangeovers?.map(c => [c.calendar_booking_id, c]) || []
      );

      // Track which bookings we've processed
      const processedBookingIds = new Set();

      // Process each booking
      for (const booking of bookings) {
        DebugLogger.log('CalendarService', 'Processing booking', {
          uid: booking.uid,
          start: booking.start,
          end: booking.end
        });

        try {
          const existing = existingBookings.get(booking.uid);
          processedBookingIds.add(booking.uid);

          DebugLogger.log('CalendarService', 'Existing booking check', {
            bookingId: booking.uid,
            exists: !!existing,
            existingId: existing?.id
          });

          const checkinDate = booking.start.toISOString().split('T')[0];
          const checkoutDate = booking.end.toISOString().split('T')[0];

          if (!existing) {
            // Create new booking
            const { error: insertError } = await supabase
              .from('changeovers')
              .insert({
                property_id: propertyId,
                checkin_date: checkinDate,
                checkout_date: checkoutDate,
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
          } else if (
            existing.checkin_date !== checkinDate ||
            existing.checkout_date !== checkoutDate
          ) {
            // Update if dates have changed
            const { error: updateError } = await supabase
              .from('changeovers')
              .update({
                checkin_date: checkinDate,
                checkout_date: checkoutDate
              })
              .eq('id', existing.id);

            if (updateError) {
              DebugLogger.error('CalendarService', 'Failed to update changeover', {
                error: updateError,
                booking: {
                  uid: booking.uid,
                  start: booking.start,
                  end: booking.end
                }
              });
              throw updateError;
            }

            DebugLogger.log('CalendarService', 'Updated existing changeover', {
              bookingId: booking.uid,
              oldDates: {
                checkin: existing.checkin_date,
                checkout: existing.checkout_date
              },
              newDates: {
                checkin: checkinDate,
                checkout: checkoutDate
              }
            });
          }
        } catch (bookingError) {
          DebugLogger.error('CalendarService', `Error processing booking ${booking.uid}`, bookingError);
          continue;
        }
      }

      // Find and delete removed bookings
      const removedBookings = Array.from(existingBookings.entries())
        .filter(([id]) => !processedBookingIds.has(id))
        .map(([_, changeover]) => changeover.id);

      if (removedBookings.length > 0) {
        DebugLogger.log('CalendarService', 'Deleting removed bookings', {
          count: removedBookings.length,
          ids: removedBookings
        });

        const { error: deleteError } = await supabase
          .from('changeovers')
          .delete()
          .in('id', removedBookings);

        if (deleteError) {
          DebugLogger.error('CalendarService', 'Failed to delete removed bookings', deleteError);
          throw deleteError;
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