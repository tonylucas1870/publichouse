/*
  # Fix notification trigger functions

  1. Changes
    - Update trigger functions to use property owner's ID instead of changeover/finding creator
    - Add property owner lookup to all notification functions
    - Add property owner ID to notification data for future reference

  2. Security
    - Functions remain security definer
    - No changes to RLS policies needed
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

-- Update finding created notification
CREATE OR REPLACE FUNCTION notify_finding_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_name text;
  v_property_owner uuid;
BEGIN
  -- Get property details through changeover
  SELECT p.name, p.created_by INTO v_property_name, v_property_owner
  FROM properties p
  JOIN changeovers c ON c.property_id = p.id
  WHERE c.id = NEW.changeover_id;

  -- Queue notification for property owner
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
  RETURN NEW;
END;
$$;

-- Update finding status notification
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
    -- Get property details through changeover
    SELECT p.name, p.created_by INTO v_property_name, v_property_owner
    FROM properties p
    JOIN changeovers c ON c.property_id = p.id
    WHERE c.id = NEW.changeover_id;

    -- Queue notification for property owner
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
  RETURN NEW;
END;
$$;

-- Update finding updates notification
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
  -- Get property details through changeover
  SELECT p.name, p.created_by INTO v_property_name, v_property_owner
  FROM properties p
  JOIN changeovers c ON c.property_id = p.id
  WHERE c.id = NEW.changeover_id;

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

  RETURN NEW;
END;
$$;