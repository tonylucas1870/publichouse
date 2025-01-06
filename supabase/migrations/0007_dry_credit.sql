/*
  # Add missing room policies

  This migration adds any missing policies for the rooms table, checking first to avoid conflicts.
*/

-- First, check if policies exist and drop them if they do
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view rooms for their properties" ON rooms;
  DROP POLICY IF EXISTS "Users can create rooms for their properties" ON rooms;
  DROP POLICY IF EXISTS "Anyone can view rooms for shared changeovers" ON rooms;
END $$;

-- Create policies
CREATE POLICY "Users can view rooms for their properties"
ON rooms FOR SELECT
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can create rooms for their properties"
ON rooms FOR INSERT
TO authenticated
WITH CHECK (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Anyone can view rooms for shared changeovers"
ON rooms FOR SELECT
TO public
USING (
  property_id IN (
    SELECT property_id 
    FROM changeovers 
    WHERE share_token IS NOT NULL
  )
);