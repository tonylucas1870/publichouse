-- Update changeover created notification with error handling
CREATE OR REPLACE FUNCTION notify_changeover_created()
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
    WHERE id = NEW.property_id;

    -- Queue notification for property owner
    IF v_property_owner IS NOT NULL THEN
      PERFORM queue_notification(
        v_property_owner,
        'changeover_created'::notification_type,
        jsonb_build_object(
          'property_name', v_property_name,
          'checkin_date', NEW.checkin_date,
          'checkout_date', NEW.checkout_date,
          'property_owner_id', v_property_owner
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Failed to send changeover created notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Update changeover status notification with error handling
CREATE OR REPLACE FUNCTION notify_changeover_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_owner uuid;
  v_property_name text;
BEGIN
  IF OLD.status <> NEW.status THEN
    BEGIN
      -- Get property owner and name
      SELECT created_by, name INTO v_property_owner, v_property_name
      FROM properties
      WHERE id = NEW.property_id;

      -- Queue notification for property owner
      IF v_property_owner IS NOT NULL THEN
        PERFORM queue_notification(
          v_property_owner,
          'changeover_status_changed'::notification_type,
          jsonb_build_object(
            'property_name', v_property_name,
            'checkin_date', NEW.checkin_date,
            'checkout_date', NEW.checkout_date,
            'status', NEW.status,
            'property_owner_id', v_property_owner
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the trigger
      RAISE WARNING 'Failed to send changeover status notification: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;