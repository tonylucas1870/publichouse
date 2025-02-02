-- Temporarily disable notifications
SELECT disable_notifications();

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS changeover_notification_trigger ON changeovers;
DROP TRIGGER IF EXISTS notify_on_changeover ON changeovers;

-- Drop old notification functions if they exist
DROP FUNCTION IF EXISTS notify_on_changeover() CASCADE;
DROP FUNCTION IF EXISTS changeover_notification_trigger() CASCADE;

-- Re-enable notifications
SELECT enable_notifications();

-- Add comment explaining cleanup
COMMENT ON SCHEMA public IS 'Cleaned up legacy notification triggers and functions.
The notification system now uses the queue_notification function with proper type handling.';