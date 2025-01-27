/*
  # Add Email Notifications Support

  1. New Tables
    - `notification_preferences`
      - User preferences for different notification types
    - `notification_templates`
      - Email templates for different notification types
    
  2. Functions
    - `send_notification` - Handles sending notifications via SendGrid
    - `handle_notification_event` - Processes notification events
    
  3. Security
    - RLS policies for notification preferences
*/

-- Create notification types enum
CREATE TYPE notification_type AS ENUM (
  'changeover_created',
  'changeover_status_changed',
  'finding_created',
  'finding_status_changed',
  'finding_comment_added',
  'finding_media_added'
);

-- Create notification preferences table
CREATE TABLE notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Create notification templates table
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type notification_type NOT NULL UNIQUE,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own notification preferences"
ON notification_preferences
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view notification templates"
ON notification_templates
FOR SELECT
TO authenticated
USING (true);

-- Create function to send notification
CREATE OR REPLACE FUNCTION send_notification(
  p_user_id uuid,
  p_notification_type notification_type,
  p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text;
  v_template record;
  v_enabled boolean;
BEGIN
  -- Check if user wants this notification
  SELECT enabled INTO v_enabled
  FROM notification_preferences
  WHERE user_id = p_user_id
  AND notification_type = p_notification_type;

  -- Exit if notifications are disabled
  IF NOT FOUND OR NOT v_enabled THEN
    RETURN;
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  -- Get template
  SELECT * INTO v_template
  FROM notification_templates
  WHERE notification_type = p_notification_type;

  -- Send email via Edge Function
  PERFORM net.http_post(
    url := CONCAT(current_setting('app.settings.edge_function_url'), '/send-email'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', current_setting('app.settings.edge_function_key')
    ),
    body := jsonb_build_object(
      'to', v_user_email,
      'subject', v_template.subject_template,
      'body', v_template.body_template,
      'data', p_data
    )
  );
END;
$$;

-- Insert default templates
INSERT INTO notification_templates (notification_type, subject_template, body_template) VALUES
('changeover_created', 
 'New Changeover Created for {{property_name}}',
 'A new changeover has been scheduled for {{property_name}}.\n\nCheck-in: {{checkin_date}}\nCheck-out: {{checkout_date}}'
),
('changeover_status_changed',
 'Changeover Status Updated for {{property_name}}',
 'The changeover for {{property_name}} has been updated to {{status}}.\n\nCheck-in: {{checkin_date}}\nCheck-out: {{checkout_date}}'
),
('finding_created',
 'New Finding Reported at {{property_name}}',
 'A new finding has been reported at {{property_name}} in {{location}}.\n\nDescription: {{description}}'
),
('finding_status_changed',
 'Finding Status Updated at {{property_name}}',
 'A finding at {{property_name}} has been updated to {{status}}.\n\nDescription: {{description}}\nLocation: {{location}}'
),
('finding_comment_added',
 'New Comment on Finding at {{property_name}}',
 'A new comment has been added to a finding at {{property_name}}:\n\n"{{comment}}"\n\nDescription: {{description}}\nLocation: {{location}}'
),
('finding_media_added',
 'New Media Added to Finding at {{property_name}}',
 'New media has been added to a finding at {{property_name}}.\n\nDescription: {{description}}\nLocation: {{location}}');

-- Create default preferences for existing users
INSERT INTO notification_preferences (user_id, notification_type)
SELECT 
  u.id,
  e.notification_type
FROM auth.users u
CROSS JOIN (
  SELECT unnest(enum_range(NULL::notification_type)) as notification_type
) e;

-- Create trigger to create preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notification_preferences (user_id, notification_type)
  SELECT 
    NEW.id,
    e.notification_type
  FROM (
    SELECT unnest(enum_range(NULL::notification_type)) as notification_type
  ) e;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_notification_preferences_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_default_notification_preferences();