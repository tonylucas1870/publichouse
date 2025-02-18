import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to fetch calendar data
async function fetchCalendarData(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

// Helper to parse ICS data
function parseICS(icsData: string) {
  const bookings = [];
  const lines = icsData.split('\n');
  let currentBooking: any = null;

  for (let line of lines) {
    line = line.trim();

    if (line === 'BEGIN:VEVENT') {
      currentBooking = {};
    } else if (line === 'END:VEVENT') {
      if (currentBooking?.start && currentBooking?.end && currentBooking?.uid) {
        bookings.push(currentBooking);
      }
      currentBooking = null;
    } else if (currentBooking) {
      if (line.startsWith('DTSTART')) {
        currentBooking.start = parseICSDate(line.split(':')[1]);
      } else if (line.startsWith('DTEND')) {
        currentBooking.end = parseICSDate(line.split(':')[1]);
      } else if (line.startsWith('UID')) {
        currentBooking.uid = line.split(':')[1];
      }
    }
  }

  return bookings;
}

// Helper to parse ICS dates
function parseICSDate(dateStr: string) {
  if (dateStr.length === 8) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return new Date(Date.UTC(+year, +month - 1, +day));
  }

  if (dateStr.includes('T')) {
    const [datePart, timePart] = dateStr.split('T');
    const year = datePart.slice(0, 4);
    const month = datePart.slice(4, 6);
    const day = datePart.slice(6, 8);
    const hour = timePart.slice(0, 2);
    const minute = timePart.slice(2, 4);
    const second = timePart.slice(4, 6);
    return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  }

  throw new Error('Unsupported date format');
}

serve(async (req) => {
  try {
    // Get properties with calendar URLs
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, calendar_url, created_by')
      .not('calendar_url', 'is', null);

    if (propertiesError) throw propertiesError;

    console.log(`Found ${properties?.length || 0} properties with calendar URLs`);

    // Process each property
    const results = await Promise.allSettled(
      (properties || []).map(async (property) => {
        try {
          console.log(`Processing property ${property.id}`);

          // Update sync status to pending
          const { error: pendingError } = await supabase
            .from('properties')
            .update({
              calendar_sync_status: 'pending',
              calendar_sync_error: null
            })
            .eq('id', property.id);

          if (pendingError) throw pendingError;

          // Fetch and parse calendar data
          const icsData = await fetchCalendarData(property.calendar_url);
          const bookings = parseICS(icsData);

          console.log(`Found ${bookings.length} bookings for property ${property.id}`);

          // Get existing bookings
          const { data: existingChangeovers } = await supabase
            .from('changeovers')
            .select('id, calendar_booking_id, checkin_date, checkout_date')
            .eq('property_id', property.id)
            .not('calendar_booking_id', 'is', null);

          // Create map of existing bookings
          const existingBookings = new Map(
            existingChangeovers?.map(c => [c.calendar_booking_id, c]) || []
          );

          // Track processed bookings
          const processedIds = new Set();

          // Process each booking
          for (const booking of bookings) {
            const existing = existingBookings.get(booking.uid);
            processedIds.add(booking.uid);

            const checkinDate = booking.start.toISOString().split('T')[0];
            const checkoutDate = booking.end.toISOString().split('T')[0];
            console.debug("Booking ID is" + booking.uid)
            if (!existing) {
              console.debug("Creating New Booking")
              // Create new booking
              const { error: insertError } = await supabase
                .from('changeovers')
                .insert({
                  property_id: property.id,
                  checkin_date: checkinDate,
                  checkout_date: checkoutDate,
                  calendar_booking_id: booking.uid,
                  created_by: property.created_by
                });
              
              if (insertError) {
                console.error('Error creating booking:', insertError);
                throw insertError;
              }
            } else if (
              existing.checkin_date !== checkinDate ||
              existing.checkout_date !== checkoutDate
            ) {
              console.debug("Date change of existing booking")
              console.debug("Updating booking", {
                id: existing.id,
                oldCheckin: existing.checkin_date,
                newCheckin: checkinDate,
                oldCheckout: existing.checkout_date,
                newCheckout: checkoutDate
              });

              // Update if dates changed
              const { error: updateError } = await supabase
                .from('changeovers')
                .update({
                  checkin_date: checkinDate,
                  checkout_date: checkoutDate
                })
                .eq('id', existing.id);

              if (updateError) {
                console.error('Error updating booking:', updateError);
                throw updateError;
              }
            }
          }

          // Find and delete removed bookings
          const removedBookings = Array.from(existingBookings.entries())
            .filter(([id]) => !processedIds.has(id))
            .map(([_, changeover]) => changeover.id);

          if (removedBookings.length > 0) {
            console.debug("Removing Bookings:" + JSON.stringify(removedBookings))
            const { error: deleteError } = await supabase
              .from('changeovers')
              .delete()
              .in('id', removedBookings);

            if (deleteError) {
              console.error('Error deleting bookings:', deleteError);
              throw deleteError;
            }
          }

          // Update sync status
          const { error: syncError } = await supabase
            .from('properties')
            .update({
              calendar_sync_status: 'synced',
              calendar_last_synced: new Date().toISOString(),
              calendar_sync_error: null,
              initial_sync_complete: true
            })
            .eq('id', property.id);

          if (syncError) throw syncError;

          return {
            propertyId: property.id,
            status: 'success',
            bookingsProcessed: bookings.length,
            bookingsRemoved: removedBookings.length
          };
        } catch (error) {
          console.error(`Error processing property ${property.id}:`, error);

          // Update sync status to failed
          await supabase
            .from('properties')
            .update({
              calendar_sync_status: 'failed',
              calendar_sync_error: error.message
            })
            .eq('id', property.id);

          return {
            propertyId: property.id,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in calendar sync:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});