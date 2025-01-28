/*
  # Anonymous Users Implementation

  1. New Tables
    - `anonymous_users`
      - `id` (uuid, primary key)
      - `name` (text)
      - `anonymous_id` (text, unique)
      - `changeover_ids` (uuid array)
      - `created_at` (timestamptz)
      - `last_seen` (timestamptz)

  2. Changes
    - Add `anonymous_user_id` to findings table
    - Add RLS policies for anonymous users

  3. Security
    - Enable RLS
    - Add policies for anonymous access
*/

-- Create anonymous users table
CREATE TABLE anonymous_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  anonymous_id text UNIQUE NOT NULL,
  changeover_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now()
);

-- Add anonymous user reference to findings
ALTER TABLE findings 
ADD COLUMN anonymous_user_id uuid REFERENCES anonymous_users(id);

-- Enable RLS
ALTER TABLE anonymous_users ENABLE ROW LEVEL SECURITY;

-- Create anonymous users service
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
  v_user_id uuid;
  v_changeover_ids uuid[];
BEGIN
  -- First try to get existing user
  SELECT id, changeover_ids INTO v_user_id, v_changeover_ids
  FROM anonymous_users
  WHERE anonymous_id = p_anonymous_id;

  IF v_user_id IS NULL THEN
    -- Create new user
    INSERT INTO anonymous_users (name, anonymous_id, changeover_ids)
    VALUES (p_name, p_anonymous_id, ARRAY[p_changeover_id])
    RETURNING id, name, anonymous_id, changeover_ids
    INTO v_user_id, name, anonymous_id, v_changeover_ids;
  ELSE
    -- Update last seen and add changeover if not already present
    UPDATE anonymous_users
    SET 
      last_seen = now(),
      changeover_ids = array_append(
        array_remove(changeover_ids, p_changeover_id),
        p_changeover_id
      )
    WHERE id = v_user_id;
  END IF;

  RETURN QUERY
  SELECT au.id, au.name, au.anonymous_id, au.changeover_ids
  FROM anonymous_users au
  WHERE au.id = v_user_id;
END;
$$;

-- Create function to convert anonymous user to full account
CREATE OR REPLACE FUNCTION convert_to_full_account(
  p_anonymous_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update findings to link to new user
  UPDATE findings
  SET 
    user_id = p_user_id,
    anonymous_user_id = NULL
  WHERE anonymous_user_id = (
    SELECT id FROM anonymous_users WHERE anonymous_id = p_anonymous_id
  );

  -- Delete anonymous user
  DELETE FROM anonymous_users
  WHERE anonymous_id = p_anonymous_id;

  RETURN true;
END;
$$;

-- RLS Policies
CREATE POLICY "Anonymous users can view own profile"
  ON anonymous_users
  FOR SELECT
  USING (
    anonymous_id = current_setting('app.anonymous_id', true)
  );

CREATE POLICY "Service role can manage anonymous users"
  ON anonymous_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);