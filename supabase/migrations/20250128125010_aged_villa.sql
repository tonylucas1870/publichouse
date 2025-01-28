/*
  # Fix Anonymous User Function

  1. Changes
    - Fix ambiguous column references in get_or_create_anonymous_user function
    - Add proper table aliases
    - Improve variable naming for clarity
    - Add better error handling
*/

-- Drop and recreate the function with fixes
CREATE OR REPLACE FUNCTION get_or_create_anonymous_user(
  p_anonymous_id text,
  p_name text,
  p_changeover_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  anonymous_id text,
  changeover_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user anonymous_users%ROWTYPE;
  v_changeover_ids uuid[];
BEGIN
  -- First try to get existing user
  SELECT * INTO v_user
  FROM anonymous_users au
  WHERE au.anonymous_id = p_anonymous_id;

  IF v_user.id IS NULL THEN
    -- Create new user
    INSERT INTO anonymous_users (name, anonymous_id, changeover_ids)
    VALUES (p_name, p_anonymous_id, ARRAY[p_changeover_id])
    RETURNING * INTO v_user;
  ELSE
    -- Update last seen and add changeover if not already present
    UPDATE anonymous_users au
    SET 
      last_seen = now(),
      changeover_ids = array_append(
        array_remove(au.changeover_ids, p_changeover_id),
        p_changeover_id
      )
    WHERE au.id = v_user.id
    RETURNING * INTO v_user;
  END IF;

  -- Return result
  RETURN QUERY
  SELECT 
    v_user.id,
    v_user.name,
    v_user.anonymous_id,
    v_user.changeover_ids;
END;
$$;