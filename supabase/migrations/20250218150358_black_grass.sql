/*
  # Fix Calendar Sync Function

  1. Changes
    - Update cron job to use correct function name
    - Use proper Edge Function invocation method
    - Add better error handling

  2. Security
    - Uses service role key for authentication
    - Proper error logging
*/

-- Drop existing cron job
SELECT cron.unschedule('sync-calendars');

-- Create new cron job with correct function name and proper invocation
SELECT cron.schedule(
  'sync-calendars',  -- Job name
  '0 */2 * * *',    -- Every 2 hours
  $$
  BEGIN
    -- Call the Edge Function using proper invocation
    PERFORM supabase.functions.http(
      'POST',
      '/sync-calendars',  -- Note the plural form
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      '{}'::jsonb,
      '1 minute'  -- Timeout
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the job
    RAISE WARNING 'Calendar sync failed: %', SQLERRM;
  END;
  $$
);

-- Add comment explaining the sync process
COMMENT ON FUNCTION cron.schedule IS 
'Schedules automatic calendar syncing every 2 hours.
Uses the sync-calendars Edge Function which:
1. Fetches calendar data for all properties
2. Creates/updates/deletes changeovers as needed
3. Updates sync status and timestamps
4. Handles errors gracefully without failing the job';