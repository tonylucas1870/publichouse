/*
  # Add property sharing functionality
  
  1. New Tables
    - `property_access`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `user_id` (uuid, references auth.users)
      - `access_level` (text, enum of access levels)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Changes
    - Add property access table and policies
    - Update existing access views and policies
    - Add function to manage property access

  3. Security
    - Enable RLS on property_access table
    - Add policies for property access management
*/

-- Step 1: Create property access table
CREATE TYPE property_access_level AS ENUM ('read', 'write', 'admin');

CREATE TABLE property_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    access_level property_access_level NOT NULL DEFAULT 'read',
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(property_id, user_id)
);

-- Enable RLS
ALTER TABLE property_access ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policies for property access table
CREATE POLICY "property_owners_manage_access"
ON property_access
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
);

-- Step 3: Update property access view
DROP VIEW IF EXISTS accessible_properties CASCADE;

CREATE VIEW accessible_properties AS
SELECT p.*
FROM properties p
WHERE 
    p.created_by = auth.uid()  -- Owner access
    OR EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = p.id
        AND pa.user_id = auth.uid()
    );

-- Step 4: Create function to manage property access
CREATE OR REPLACE FUNCTION manage_property_access(
    property_id uuid,
    user_email text,
    access_level property_access_level
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
        SELECT 1 FROM properties
        WHERE id = property_id
        AND created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized to manage access for this property';
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
        property_id,
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

-- Step 5: Update changeover policies to include property access
DROP VIEW IF EXISTS accessible_changeovers CASCADE;

CREATE VIEW accessible_changeovers AS
SELECT c.*
FROM changeovers c
WHERE 
    c.share_token IS NOT NULL  -- Public share access
    OR EXISTS (
        SELECT 1 FROM accessible_properties p
        WHERE p.id = c.property_id
    );

-- Step 6: Create indexes for performance
CREATE INDEX idx_property_access_user_id ON property_access(user_id);
CREATE INDEX idx_property_access_property_id ON property_access(property_id);
CREATE INDEX idx_property_access_created_by ON property_access(created_by);