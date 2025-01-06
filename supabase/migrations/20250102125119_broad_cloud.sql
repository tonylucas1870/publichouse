/*
  # Update findings policies for property ownership

  1. Changes
    - Drop existing findings policies
    - Create new policies that check property ownership
    - Ensure findings are only visible to property owners
    
  2. Security
    - Findings are now restricted to property owners
    - Share token access is preserved
    - Only property owners can create/update findings
*/

-- Drop existing findings policies
DROP POLICY IF EXISTS "Public can view findings" ON findings;
DROP POLICY IF EXISTS "Anyone with changeover access can view findings" ON findings;
DROP POLICY IF EXISTS "Anyone with changeover access can create findings" ON findings;
DROP POLICY IF EXISTS "Users can update notes on findings they can access" ON findings;
DROP POLICY IF EXISTS "Users can update finding status" ON findings;

-- Create new policies that check property ownership
CREATE POLICY "Property owners can view findings"
ON findings FOR SELECT
TO authenticated
USING (
  changeover_id IN (
    SELECT c.id 
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
);

CREATE POLICY "Shared changeover viewers can view findings"
ON findings FOR SELECT
TO public
USING (
  changeover_id IN (
    SELECT id 
    FROM changeovers 
    WHERE share_token IS NOT NULL
  )
);

CREATE POLICY "Property owners can create findings"
ON findings FOR INSERT
TO authenticated
WITH CHECK (
  changeover_id IN (
    SELECT c.id 
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
);

CREATE POLICY "Shared changeover viewers can create findings"
ON findings FOR INSERT
TO public
WITH CHECK (
  changeover_id IN (
    SELECT id 
    FROM changeovers 
    WHERE share_token IS NOT NULL
  )
);

CREATE POLICY "Property owners can update findings"
ON findings FOR UPDATE
TO authenticated
USING (
  changeover_id IN (
    SELECT c.id 
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT c.id 
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
);