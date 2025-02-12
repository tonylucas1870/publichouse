-- Add notification template
INSERT INTO notification_templates (notification_type, subject_template, body_template)
VALUES (
  'changeover_deleted',
  'Changeover Deleted: {{property_name}}',
  'A changeover has been deleted for {{property_name}}.\n\nCheck-in: {{checkin_date}}\nCheck-out: {{checkout_date}}'
);

-- Create notification trigger function
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

    -- Queue notification for property owner
    IF v_property_owner IS NOT NULL THEN
      PERFORM queue_notification(
        v_property_owner,
        'changeover_deleted'::notification_type,
        jsonb_build_object(
          'property_name', v_property_name,
          'checkin_date', OLD.checkin_date,
          'checkout_date', OLD.checkout_date,
          'property_owner_id', v_property_owner
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

-- Create trigger
DROP TRIGGER IF EXISTS notify_changeover_deleted_trigger ON changeovers;
CREATE TRIGGER notify_changeover_deleted_trigger
  AFTER DELETE ON changeovers
  FOR EACH ROW
  EXECUTE FUNCTION notify_changeover_deleted();