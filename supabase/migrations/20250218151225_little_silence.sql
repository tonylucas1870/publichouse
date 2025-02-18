/*
  # Fix Calendar Sync Cron Job

  1. Changes
    - Replace PERFORM with SELECT for cron job
    - Use proper function invocation
    - Add better error handling

  2. Security
    - Uses service role key for authentication
    - Proper error logging
*/

-- Drop existing cron job
SELECT cron.unschedule('sync-calendars');

-- Create new cron job with correct function invocation
SELECT cron.schedule(
  'sync-calendars',  -- Job name
  '0 */2 * * *',    -- Every 2 hours
  $$
  SELECT
    CASE 
      WHEN response.status_code BETWEEN 200 AND 299 THEN
        NULL  -- Success case
      ELSE
        RAISE WARNING 'Calendar sync failed with status %: %',
          response.status_code,
          response.content
    END
  FROM
    http((
      'POST',
      current_setting('app.settings.edge_function_base_url') || '/sync-calendars',
      ARRAY[
        ('Content-Type', 'application/json'),
        ('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
      ],
      '60000',  -- 60 second timeout
      '{}'
    )::http_request) as response;
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