-- Create cron job for calendar sync
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add cron job to sync calendars every 2 hours
SELECT cron.schedule(
  'sync-calendars',  -- Job name
  '0 */2 * * *',    -- Every 2 hours
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.edge_function_base_url') || '/sync-calendars',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  $$
);

-- Add comment explaining the cron job
COMMENT ON FUNCTION cron.schedule IS 
'Schedules automatic calendar syncing every 2 hours for all properties with calendar URLs configured.
The sync process will:
1. Fetch latest calendar data
2. Create new changeovers for new bookings
3. Update existing changeovers if dates have changed
4. Delete changeovers for removed bookings
5. Update sync status and timestamps';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;