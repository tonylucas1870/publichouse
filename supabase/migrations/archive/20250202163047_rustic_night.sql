/*
  # Fix notification triggers

  1. Changes
    - Remove send_notification function calls
    - Update trigger functions to use queue_notification instead
    - Fix error handling in trigger functions
*/

-- Update changeover created notification
CREATE OR REPLACE FUNCTION notify_changeover_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_owner uuid;
BEGIN
  -- Get property owner
  SELECT created_by INTO v_property_owner
  FROM properties
  WHERE id = NEW.property_id;

  -- Queue notification for property owner
  PERFORM queue_notification(
    v_property_owner,
    'changeover_created'::notification_type,
    jsonb_build_object(
      'property_name', (SELECT name FROM properties WHERE id = NEW.property_id),
      'checkin_date', NEW.checkin_date,
      'checkout_date', NEW.checkout_date,
      'property_owner_id', v_property_owner
    )
  );
  RETURN NEW;
END;
$$;

-- Update changeover status notification
CREATE OR REPLACE FUNCTION notify_changeover_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_owner uuid;
BEGIN
  IF OLD.status <> NEW.status THEN
    -- Get property owner
    SELECT created_by INTO v_property_owner
    FROM properties
    WHERE id = NEW.property_id;

    -- Queue notification for property owner
    PERFORM queue_notification(
      v_property_owner,
      'changeover_status_changed'::notification_type,
      jsonb_build_object(
        'property_name', (SELECT name FROM properties WHERE id = NEW.property_id),
        'checkin_date', NEW.checkin_date,
        'checkout_date', NEW.checkout_date,
        'status', NEW.status,
        'property_owner_id', v_property_owner
      )
    );
  END IF;
  RETURN NEW;
END;
$$;