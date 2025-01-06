/*
  # Add property access with roles

  1. New Tables
    - `property_access`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `user_id` (uuid, references auth.users)
      - `access_level` (text, check constraint for valid roles)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Functions
    - `manage_property_access` function for adding users by email
    - `get_property_access` function for checking access levels

  3. Changes
    - Adds property access table with roles
    - Creates management functions
    - Sets up proper indexes
*/

-- Create property access table
CREATE TABLE IF NOT EXISTS property_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    access_level text NOT NULL CHECK (access_level IN ('cleaner', 'maintenance', 'admin')),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(property_id, user_id)
);

-- Create function to manage property access
CREATE OR REPLACE FUNCTION manage_property_access(
    input_property_id uuid,
    user_email text,
    access_level text
)
RETURNS property_access
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id uuid;
    access_record property_access;
BEGIN
    -- Check if user has permission to manage access
    IF NOT EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = input_property_id
        AND p.created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized to manage access for this property';
    END IF;

    -- Validate access level
    IF access_level NOT IN ('cleaner', 'maintenance', 'admin') THEN
        RAISE EXCEPTION 'Invalid access level. Must be cleaner, maintenance, or admin';
    END IF;

    -- Get user ID from email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = user_email;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', user_email;
    END IF;

    -- Insert or update access record
    INSERT INTO property_access (
        property_id,
        user_id,
        access_level,
        created_by
    )
    VALUES (
        input_property_id,
        target_user_id,
        access_level,
        auth.uid()
    )
    ON CONFLICT (property_id, user_id)
    DO UPDATE SET
        access_level = EXCLUDED.access_level
    RETURNING * INTO access_record;

    RETURN access_record;
END;
$$;

-- Create function to check property access
CREATE OR REPLACE FUNCTION get_property_access(
    input_property_id uuid,
    input_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
    has_access boolean,
    access_level text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TRUE as has_access,
        COALESCE(pa.access_level, 'owner') as access_level
    FROM properties p
    LEFT JOIN property_access pa ON pa.property_id = p.id AND pa.user_id = input_user_id
    WHERE p.id = input_property_id
    AND (p.created_by = input_user_id OR pa.id IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for property access details
CREATE OR REPLACE VIEW property_access_details AS
SELECT 
    pa.id,
    pa.property_id,
    pa.user_id,
    pa.access_level,
    pa.created_at,
    pa.created_by,
    u.email as user_email,
    p.name as property_name
FROM property_access pa
JOIN auth.users u ON u.id = pa.user_id
JOIN properties p ON p.id = pa.property_id;

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_property_access_user_id ON property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property_id ON property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_property_access_level ON property_access(access_level);

-- Migrate existing property owners to property_access with admin role
INSERT INTO property_access (property_id, user_id, access_level, created_by)
SELECT id, created_by, 'admin', created_by
FROM properties
ON CONFLICT (property_id, user_id) DO NOTHING;