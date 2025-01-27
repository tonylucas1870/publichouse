-- Update edge function URL to use project URL
CREATE OR REPLACE FUNCTION get_project_url()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  -- Extract project URL from service role key
  SELECT CASE 
    WHEN current_setting('supabase_auth.service_role_key', TRUE) IS NOT NULL THEN
      'https://' || split_part(current_setting('supabase_auth.service_role_key'), '.', 1) || '.supabase.co'
    ELSE
      current_setting('app.settings.edge_function_url', TRUE)
  END;
$$;

-- Update database settings
ALTER DATABASE postgres SET "app.settings.edge_function_url" = current_setting('SUPABASE_URL');
ALTER DATABASE postgres SET "app.settings.edge_function_key" = current_setting('SUPABASE_ANON_KEY');

-- Update send_notification function to use project URL
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
  v_response_status int;
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
  SELECT status INTO v_response_status
  FROM http_request(
    'POST',
    CONCAT(get_project_url(), '/functions/v1/send-email'),
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('app.settings.edge_function_key'))
    ],
    jsonb_build_object(
      'to', v_user_email,
      'subject', v_template.subject_template,
      'body', v_template.body_template,
      'data', p_data
    )::text,
    10 -- timeout in seconds
  );

  IF v_response_status != 200 THEN
    RAISE EXCEPTION 'Failed to send notification. Status: %', v_response_status;
  END IF;
END;
$$;