-- Update finding created notification with error handling
CREATE OR REPLACE FUNCTION notify_finding_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_name text;
  v_property_owner uuid;
BEGIN
  BEGIN
    -- Get property details through changeover
    SELECT p.name, p.created_by INTO v_property_name, v_property_owner
    FROM properties p
    JOIN changeovers c ON c.property_id = p.id
    WHERE c.id = NEW.changeover_id;

    -- Queue notification for property owner
    IF v_property_owner IS NOT NULL THEN
      PERFORM queue_notification(
        v_property_owner,
        'finding_created'::notification_type,
        jsonb_build_object(
          'property_name', v_property_name,
          'location', NEW.location,
          'description', NEW.description,
          'property_owner_id', v_property_owner
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Failed to send finding created notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Update finding status notification with error handling
CREATE OR REPLACE FUNCTION notify_finding_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_name text;
  v_property_owner uuid;
BEGIN
  IF OLD.status <> NEW.status THEN
    BEGIN
      -- Get property details through changeover
      SELECT p.name, p.created_by INTO v_property_name, v_property_owner
      FROM properties p
      JOIN changeovers c ON c.property_id = p.id
      WHERE c.id = NEW.changeover_id;

      -- Queue notification for property owner
      IF v_property_owner IS NOT NULL THEN
        PERFORM queue_notification(
          v_property_owner,
          'finding_status_changed'::notification_type,
          jsonb_build_object(
            'property_name', v_property_name,
            'location', NEW.location,
            'description', NEW.description,
            'status', NEW.status,
            'property_owner_id', v_property_owner
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the trigger
      RAISE WARNING 'Failed to send finding status notification: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update finding updates notification with error handling
CREATE OR REPLACE FUNCTION notify_finding_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_name text;
  v_property_owner uuid;
  v_old_notes jsonb;
  v_new_notes jsonb;
  v_old_images jsonb;
  v_new_images jsonb;
BEGIN
  BEGIN
    -- Get property details through changeover
    SELECT p.name, p.created_by INTO v_property_name, v_property_owner
    FROM properties p
    JOIN changeovers c ON c.property_id = p.id
    WHERE c.id = NEW.changeover_id;

    IF v_property_owner IS NOT NULL THEN
      -- Check for new notes
      v_old_notes := COALESCE(OLD.notes, '[]'::jsonb);
      v_new_notes := COALESCE(NEW.notes, '[]'::jsonb);
      
      IF jsonb_array_length(v_new_notes) > jsonb_array_length(v_old_notes) THEN
        -- Queue notification for property owner
        PERFORM queue_notification(
          v_property_owner,
          'finding_comment_added'::notification_type,
          jsonb_build_object(
            'property_name', v_property_name,
            'location', NEW.location,
            'description', NEW.description,
            'comment', v_new_notes->-1->>'text',
            'property_owner_id', v_property_owner
          )
        );
      END IF;

      -- Check for new images
      v_old_images := COALESCE(OLD.images, '[]'::jsonb);
      v_new_images := COALESCE(NEW.images, '[]'::jsonb);
      
      IF jsonb_array_length(v_new_images) > jsonb_array_length(v_old_images) THEN
        -- Queue notification for property owner
        PERFORM queue_notification(
          v_property_owner,
          'finding_media_added'::notification_type,
          jsonb_build_object(
            'property_name', v_property_name,
            'location', NEW.location,
            'description', NEW.description,
            'property_owner_id', v_property_owner
          )
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Failed to send finding update notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;