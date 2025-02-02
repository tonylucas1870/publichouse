-- Temporarily disable notifications while we fix the functions
SELECT disable_notifications();

-- Drop the previous wrapper function
DROP FUNCTION IF EXISTS send_notification(uuid, text, jsonb);
DROP FUNCTION IF EXISTS send_notification(uuid, unknown, jsonb);

-- Create a more flexible wrapper function that handles both text and unknown types
CREATE OR REPLACE FUNCTION send_notification(
  p_user_id uuid,
  p_type unknown,
  p_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cast the unknown type to notification_type and forward to queue_notification
  RETURN queue_notification(
    p_user_id,
    p_type::notification_type,
    p_data
  );
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail
  RAISE WARNING 'Failed to queue notification: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Re-enable notifications
SELECT enable_notifications();

-- Add comment explaining the wrapper function
COMMENT ON FUNCTION send_notification(uuid, unknown, jsonb) IS 
'Wrapper function that forwards to queue_notification with proper type casting.
Handles both text and unknown type parameters for backward compatibility.';