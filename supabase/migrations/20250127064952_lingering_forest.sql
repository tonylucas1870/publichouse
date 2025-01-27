/*
  # Add User Deletion Support

  1. Functions
    - `delete_user` - Handles secure user account deletion
*/

-- Create function to delete user account
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user data (RLS will handle access control)
  DELETE FROM properties WHERE created_by = v_user_id;
  DELETE FROM notification_preferences WHERE user_id = v_user_id;
  
  -- Delete auth user
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;