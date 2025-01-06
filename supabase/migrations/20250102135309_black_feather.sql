-- Create function to safely get user ID by email
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input text)
RETURNS TABLE (id uuid, email text) 
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only allow authenticated users to look up other users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email
  FROM auth.users u 
  WHERE u.email = email_input;
END;
$$;