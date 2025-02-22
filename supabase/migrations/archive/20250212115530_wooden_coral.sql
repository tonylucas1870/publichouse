/*
  # Add Changeover Deleted Notification

  1. Changes
    - Add changeover_deleted notification type
    - Add notification template
    - Create notification trigger for deleted changeovers

  This migration adds support for notifying property owners when changeovers are deleted.
*/

-- Add notification template if it doesn't exist
INSERT INTO notification_templates (notification_type, subject_template, body_template)
SELECT 
  'changeover_deleted'::notification_type,
  'Changeover Cancelled: {{property_name}}',
  'A changeover has been cancelled for {{property_name}}.\n\nCheck-in: {{checkin_date}}\nCheck-out: {{checkout_date}}'
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates 
  WHERE notification_type = 'changeover_deleted'
);

-- Update notify_changeover_deleted function with better error handling
CREATE OR REPLACE FUNCTION notify_changeover_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_owner uuid;
  v_property_name text;
BEGIN
  BEGIN
    -- Get property owner and name
    SELECT created_by, name INTO v_property_owner, v_property_name
    FROM properties
    WHERE id = OLD.property_id;

    -- Queue notification for property owner if initial sync is complete
    IF v_property_owner IS NOT NULL AND EXISTS (
      SELECT 1 FROM properties 
      WHERE id = OLD.property_id 
      AND initial_sync_complete = true
    ) THEN
      PERFORM queue_notification(
        v_property_owner,
        'changeover_deleted'::notification_type,
        jsonb_build_object(
          'property_name', v_property_name,
          'checkin_date', OLD.checkin_date,
          'checkout_date', OLD.checkout_date,
          'property_owner_id', v_property_owner,
          'was_calendar_sync', OLD.calendar_booking_id IS NOT NULL
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Failed to send changeover deleted notification: %', SQLERRM;
  END;
  
  RETURN OLD;
END;
$$;

-- Drop and recreate trigger to ensure it's up to date
DROP TRIGGER IF EXISTS notify_changeover_deleted_trigger ON changeovers;
CREATE TRIGGER notify_changeover_deleted_trigger
  AFTER DELETE ON changeovers
  FOR EACH ROW
  EXECUTE FUNCTION notify_changeover_deleted();

-- Add comment explaining notification
COMMENT ON FUNCTION notify_changeover_deleted() IS 
'Sends notification when a changeover is deleted.
Only sends notifications for properties that have completed initial sync
to avoid noise during calendar synchronization.';