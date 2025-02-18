/*
  # Calendar Sync with pg_cron

  1. Changes
    - Add pg_cron extension
    - Create calendar sync function
    - Schedule sync job to run every 2 hours
    - Add helper functions for job management

  This migration implements automated calendar syncing using pg_cron.
*/

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to sync calendars
CREATE OR REPLACE FUNCTION sync_calendars()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property RECORD;
  v_bookings jsonb;
  v_existing_bookings jsonb;
  v_processed_ids text[];
  v_removed_bookings uuid[];
BEGIN
  -- Process each property with a calendar URL
  FOR v_property IN 
    SELECT id, calendar_url, created_by 
    FROM properties 
    WHERE calendar_url IS NOT NULL
  LOOP
    BEGIN
      -- Update sync status to pending
      UPDATE properties 
      SET calendar_sync_status = 'pending',
          calendar_sync_error = NULL
      WHERE id = v_property.id;

      -- Get bookings from calendar URL
      SELECT content::jsonb INTO v_bookings
      FROM http_get(v_property.calendar_url);

      -- Get existing bookings
      SELECT jsonb_agg(to_jsonb(c)) INTO v_existing_bookings
      FROM changeovers c
      WHERE property_id = v_property.id
      AND calendar_booking_id IS NOT NULL;

      -- Process each booking
      FOR booking IN SELECT * FROM jsonb_array_elements(v_bookings)
      LOOP
        -- Add to processed IDs
        v_processed_ids := array_append(v_processed_ids, booking->>'uid');

        -- Check if booking exists
        IF NOT EXISTS (
          SELECT 1 FROM changeovers 
          WHERE calendar_booking_id = booking->>'uid'
        ) THEN
          -- Create new booking
          INSERT INTO changeovers (
            property_id,
            checkin_date,
            checkout_date,
            calendar_booking_id,
            created_by
          ) VALUES (
            v_property.id,
            (booking->>'start')::date,
            (booking->>'end')::date,
            booking->>'uid',
            v_property.created_by
          );
        ELSE
          -- Update existing booking if dates changed
          UPDATE changeovers
          SET 
            checkin_date = (booking->>'start')::date,
            checkout_date = (booking->>'end')::date
          WHERE calendar_booking_id = booking->>'uid'
          AND (
            checkin_date != (booking->>'start')::date OR
            checkout_date != (booking->>'end')::date
          );
        END IF;
      END LOOP;

      -- Find removed bookings
      SELECT array_agg(id) INTO v_removed_bookings
      FROM changeovers
      WHERE property_id = v_property.id
      AND calendar_booking_id IS NOT NULL
      AND calendar_booking_id != ALL(v_processed_ids);

      -- Delete removed bookings
      IF array_length(v_removed_bookings, 1) > 0 THEN
        DELETE FROM changeovers
        WHERE id = ANY(v_removed_bookings);
      END IF;

      -- Update sync status
      UPDATE properties 
      SET 
        calendar_sync_status = 'synced',
        calendar_last_synced = now(),
        calendar_sync_error = NULL,
        initial_sync_complete = true
      WHERE id = v_property.id;

    EXCEPTION WHEN OTHERS THEN
      -- Update sync status to failed
      UPDATE properties 
      SET 
        calendar_sync_status = 'failed',
        calendar_sync_error = SQLERRM
      WHERE id = v_property.id;
    END;
  END LOOP;
END;
$$;

-- Create function to schedule sync job
CREATE OR REPLACE FUNCTION schedule_calendar_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove any existing job
  PERFORM cron.unschedule('sync-calendars');
  
  -- Schedule new job to run every 2 hours
  PERFORM cron.schedule(
    'sync-calendars',
    '0 */2 * * *',
    'SELECT sync_calendars()'
  );
END;
$$;

-- Create function to unschedule sync job
CREATE OR REPLACE FUNCTION unschedule_calendar_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM cron.unschedule('sync-calendars');
END;
$$;

-- Schedule initial sync job
SELECT schedule_calendar_sync();

-- Add comment explaining sync process
COMMENT ON FUNCTION sync_calendars() IS 
'Syncs calendar data for all properties with calendar URLs.
Runs automatically every 2 hours via pg_cron.
Updates changeovers based on calendar data and tracks sync status.';