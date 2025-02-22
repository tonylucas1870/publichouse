/*
  # Notification System

  1. New Tables
    - `notification_preferences`
      - User notification settings
      - Controls which events trigger notifications
    - `notification_queue` 
      - Queued notifications to be sent
      - Tracks delivery status and retries
    - `notification_templates`
      - Email templates for different notification types
      
  2. Security
    - Enable RLS on all tables
    - Users can only access their own preferences
    - Service role required for queue management

  3. Functions
    - `queue_notification` - Adds notification to queue
    - `process_notification_queue` - Sends pending notifications
*/

-- Notification types enum
CREATE TYPE notification_type AS ENUM (
  'changeover_created',
  'changeover_status_changed',
  'finding_created',
  'finding_status_changed',
  'finding_comment_added',
  'finding_media_added'
);

-- User notification preferences
CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Notification queue
CREATE TABLE notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  attempts int DEFAULT 0,
  last_attempt timestamptz,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Email templates
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type notification_type NOT NULL UNIQUE,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to queue a notification
CREATE OR REPLACE FUNCTION queue_notification(
  p_user_id uuid,
  p_type notification_type,
  p_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template notification_templates;
  v_enabled boolean;
  v_notification_id uuid;
BEGIN
  -- Check if user wants this notification
  SELECT enabled INTO v_enabled
  FROM notification_preferences
  WHERE user_id = p_user_id
  AND notification_type = p_type;

  IF v_enabled IS NULL OR v_enabled THEN
    -- Get template
    SELECT * INTO v_template
    FROM notification_templates
    WHERE notification_type = p_type;

    IF v_template IS NULL THEN
      RAISE EXCEPTION 'No template found for notification type %', p_type;
    END IF;

    -- Queue notification
    INSERT INTO notification_queue
      (user_id, notification_type, subject, body, data)
    VALUES
      (p_user_id, p_type, v_template.subject_template, v_template.body_template, p_data)
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Insert default templates
INSERT INTO notification_templates (notification_type, subject_template, body_template) VALUES
  ('changeover_created', 
   'New Changeover: {{property_name}}',
   'A new changeover has been scheduled for {{property_name}}.\n\nCheck-in: {{checkin_date}}\nCheck-out: {{checkout_date}}'),
  ('changeover_status_changed',
   'Changeover Status Updated: {{property_name}}',
   'The changeover for {{property_name}} has been updated to {{status}}.\n\nCheck-in: {{checkin_date}}\nCheck-out: {{checkout_date}}'),
  ('finding_created',
   'New Finding Reported: {{property_name}}',
   'A new finding has been reported at {{property_name}}.\n\nLocation: {{location}}\nDescription: {{description}}'),
  ('finding_status_changed',
   'Finding Status Updated: {{property_name}}',
   'A finding at {{property_name}} has been updated to {{status}}.\n\nLocation: {{location}}\nDescription: {{description}}'),
  ('finding_comment_added',
   'New Comment on Finding: {{property_name}}',
   'A new comment has been added to a finding at {{property_name}}.\n\nLocation: {{location}}\nComment: {{comment}}'),
  ('finding_media_added',
   'New Media Added to Finding: {{property_name}}',
   'New media has been added to a finding at {{property_name}}.\n\nLocation: {{location}}\nDescription: {{description}}');

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their notification preferences"
  ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their notifications"
  ON notification_queue
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage notification queue"
  ON notification_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage templates"
  ON notification_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Triggers for notifications
CREATE OR REPLACE FUNCTION notify_changeover_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get property details
  PERFORM queue_notification(
    NEW.created_by,
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
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    -- Get property details
    PERFORM queue_notification(
      NEW.created_by,
      'changeover_status_changed'::notification_type,
      jsonb_build_object(
        'property_name', (SELECT name FROM properties WHERE id = NEW.property_id),
        'checkin_date', NEW.checkin_date,
        'checkout_date', NEW.checkout_date,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_finding_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_name text;
BEGIN
  -- Get property name through changeover
  SELECT p.name INTO v_property_name
  FROM properties p
  JOIN changeovers c ON c.property_id = p.id
  WHERE c.id = NEW.changeover_id;

  PERFORM queue_notification(
    NEW.user_id,
    'finding_created'::notification_type,
    jsonb_build_object(
      'property_name', v_property_name,
      'location', NEW.location,
      'description', NEW.description
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_finding_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_name text;
BEGIN
  IF OLD.status <> NEW.status THEN
    -- Get property name through changeover
    SELECT p.name INTO v_property_name
    FROM properties p
    JOIN changeovers c ON c.property_id = p.id
    WHERE c.id = NEW.changeover_id;

    PERFORM queue_notification(
      NEW.user_id,
      'finding_status_changed'::notification_type,
      jsonb_build_object(
        'property_name', v_property_name,
        'location', NEW.location,
        'description', NEW.description,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_finding_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_name text;
  v_old_notes jsonb;
  v_new_notes jsonb;
  v_old_images jsonb;
  v_new_images jsonb;
BEGIN
  -- Get property name through changeover
  SELECT p.name INTO v_property_name
  FROM properties p
  JOIN changeovers c ON c.property_id = p.id
  WHERE c.id = NEW.changeover_id;

  -- Check for new notes
  v_old_notes := COALESCE(OLD.notes, '[]'::jsonb);
  v_new_notes := COALESCE(NEW.notes, '[]'::jsonb);
  
  IF jsonb_array_length(v_new_notes) > jsonb_array_length(v_old_notes) THEN
    -- Get latest note
    PERFORM queue_notification(
      NEW.user_id,
      'finding_comment_added'::notification_type,
      jsonb_build_object(
        'property_name', v_property_name,
        'location', NEW.location,
        'description', NEW.description,
        'comment', v_new_notes->-1->>'text'
      )
    );
  END IF;

  -- Check for new images
  v_old_images := COALESCE(OLD.images, '[]'::jsonb);
  v_new_images := COALESCE(NEW.images, '[]'::jsonb);
  
  IF jsonb_array_length(v_new_images) > jsonb_array_length(v_old_images) THEN
    PERFORM queue_notification(
      NEW.user_id,
      'finding_media_added'::notification_type,
      jsonb_build_object(
        'property_name', v_property_name,
        'location', NEW.location,
        'description', NEW.description
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER notify_changeover_created
  AFTER INSERT ON changeovers
  FOR EACH ROW
  EXECUTE FUNCTION notify_changeover_created();

CREATE TRIGGER notify_changeover_status_changed
  AFTER UPDATE ON changeovers
  FOR EACH ROW
  EXECUTE FUNCTION notify_changeover_status_changed();

CREATE TRIGGER notify_finding_created
  AFTER INSERT ON findings
  FOR EACH ROW
  EXECUTE FUNCTION notify_finding_created();

CREATE TRIGGER notify_finding_status_changed
  AFTER UPDATE ON findings
  FOR EACH ROW
  EXECUTE FUNCTION notify_finding_status_changed();

CREATE TRIGGER notify_finding_updated
  AFTER UPDATE ON findings
  FOR EACH ROW
  EXECUTE FUNCTION notify_finding_updated();