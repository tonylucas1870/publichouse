-- Add initial_sync flag to properties table
ALTER TABLE properties
ADD COLUMN initial_sync_complete boolean DEFAULT false;

-- Update notify_changeover_created function to check initial sync
CREATE OR REPLACE FUNCTION notify_changeover_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_owner uuid;
  v_property_name text;
  v_initial_sync_complete boolean;
BEGIN
  BEGIN
    -- Get property owner, name and sync status
    SELECT 
      created_by,
      name,
      initial_sync_complete INTO v_property_owner, v_property_name, v_initial_sync_complete
    FROM properties
    WHERE id = NEW.property_id;

    -- Only send notification if initial sync is complete
    IF v_property_owner IS NOT NULL AND v_initial_sync_complete THEN
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
    RAISE WARNING 'Failed to send changeover created notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;