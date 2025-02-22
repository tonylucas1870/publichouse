-- Temporarily disable notifications while we fix the functions
SELECT disable_notifications();

-- Drop any lingering references to old notification function
DROP FUNCTION IF EXISTS send_notification(uuid, unknown, jsonb);

-- Create a wrapper function to handle notification type casting
CREATE OR REPLACE FUNCTION send_notification(
  p_user_id uuid,
  p_type text,
  p_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cast the text type to notification_type and forward to queue_notification
  RETURN queue_notification(
    p_user_id,
    p_type::notification_type,
    p_data
  );
END;
$$;

-- Re-enable notifications
SELECT enable_notifications();

-- Add comment explaining the wrapper function
COMMENT ON FUNCTION send_notification(uuid, text, jsonb) IS 
'Wrapper function that forwards to queue_notification with proper type casting. 
Maintains backward compatibility with any existing code still using send_notification.';