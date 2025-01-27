-- Changeover notifications
CREATE OR REPLACE FUNCTION notify_changeover_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get property owner
  PERFORM send_notification(
    (SELECT created_by FROM properties WHERE id = NEW.property_id),
    'changeover_created'::notification_type,
    jsonb_build_object(
      'property_name', (SELECT name FROM properties WHERE id = NEW.property_id),
      'checkin_date', NEW.checkin_date,
      'checkout_date', NEW.checkout_date
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_changeover_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get property owner
  PERFORM send_notification(
    (SELECT created_by FROM properties WHERE id = NEW.property_id),
    'changeover_status_changed'::notification_type,
    jsonb_build_object(
      'property_name', (SELECT name FROM properties WHERE id = NEW.property_id),
      'status', NEW.status,
      'checkin_date', NEW.checkin_date,
      'checkout_date', NEW.checkout_date
    )
  );
  RETURN NEW;
END;
$$;

-- Finding notifications
CREATE OR REPLACE FUNCTION notify_finding_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get property owner
  PERFORM send_notification(
    (
      SELECT p.created_by 
      FROM properties p
      JOIN changeovers c ON c.property_id = p.id
      WHERE c.id = NEW.changeover_id
    ),
    'finding_created'::notification_type,
    jsonb_build_object(
      'property_name', (
        SELECT p.name 
        FROM properties p
        JOIN changeovers c ON c.property_id = p.id
        WHERE c.id = NEW.changeover_id
      ),
      'description', NEW.description,
      'location', NEW.location
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_finding_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get property owner
  PERFORM send_notification(
    (
      SELECT p.created_by 
      FROM properties p
      JOIN changeovers c ON c.property_id = p.id
      WHERE c.id = NEW.changeover_id
    ),
    'finding_status_changed'::notification_type,
    jsonb_build_object(
      'property_name', (
        SELECT p.name 
        FROM properties p
        JOIN changeovers c ON c.property_id = p.id
        WHERE c.id = NEW.changeover_id
      ),
      'status', NEW.status,
      'description', NEW.description,
      'location', NEW.location
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_finding_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.notes = NEW.notes THEN
    RETURN NEW;
  END IF;

  -- Get latest comment
  WITH latest_comment AS (
    SELECT 
      comment->>'text' as text
    FROM jsonb_array_elements(NEW.notes) comment
    ORDER BY (comment->>'created_at')::timestamptz DESC
    LIMIT 1
  )
  -- Get property owner
  PERFORM send_notification(
    (
      SELECT p.created_by 
      FROM properties p
      JOIN changeovers c ON c.property_id = p.id
      WHERE c.id = NEW.changeover_id
    ),
    'finding_comment_added'::notification_type,
    jsonb_build_object(
      'property_name', (
        SELECT p.name 
        FROM properties p
        JOIN changeovers c ON c.property_id = p.id
        WHERE c.id = NEW.changeover_id
      ),
      'comment', (SELECT text FROM latest_comment),
      'description', NEW.description,
      'location', NEW.location
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_finding_media_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.images = NEW.images THEN
    RETURN NEW;
  END IF;

  -- Get property owner
  PERFORM send_notification(
    (
      SELECT p.created_by 
      FROM properties p
      JOIN changeovers c ON c.property_id = p.id
      WHERE c.id = NEW.changeover_id
    ),
    'finding_media_added'::notification_type,
    jsonb_build_object(
      'property_name', (
        SELECT p.name 
        FROM properties p
        JOIN changeovers c ON c.property_id = p.id
        WHERE c.id = NEW.changeover_id
      ),
      'description', NEW.description,
      'location', NEW.location
    )
  );
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER notify_changeover_created_trigger
AFTER INSERT ON changeovers
FOR EACH ROW
EXECUTE FUNCTION notify_changeover_created();

CREATE TRIGGER notify_changeover_status_changed_trigger
AFTER UPDATE ON changeovers
FOR EACH ROW
EXECUTE FUNCTION notify_changeover_status_changed();

CREATE TRIGGER notify_finding_created_trigger
AFTER INSERT ON findings
FOR EACH ROW
EXECUTE FUNCTION notify_finding_created();

CREATE TRIGGER notify_finding_status_changed_trigger
AFTER UPDATE OF status ON findings
FOR EACH ROW
EXECUTE FUNCTION notify_finding_status_changed();

CREATE TRIGGER notify_finding_comment_added_trigger
AFTER UPDATE OF notes ON findings
FOR EACH ROW
EXECUTE FUNCTION notify_finding_comment_added();

CREATE TRIGGER notify_finding_media_added_trigger
AFTER UPDATE OF images ON findings
FOR EACH ROW
EXECUTE FUNCTION notify_finding_media_added();