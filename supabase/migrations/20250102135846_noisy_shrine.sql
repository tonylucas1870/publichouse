/*
  # Fix access control using views
  
  1. Changes
    - Create views for access control
    - Simplify policies using views
    - Add proper indexes for performance
    
  2. Security
    - Maintain strict access control
    - Prevent infinite recursion
    - Ensure proper authorization
*/

-- Step 1: Create base views for access control
CREATE OR REPLACE VIEW accessible_properties AS
SELECT p.*
FROM properties p
WHERE 
  p.created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM property_cleaners pc
    WHERE pc.property_id = p.id
    AND pc.user_id = auth.uid()
  );

CREATE OR REPLACE VIEW accessible_changeovers AS
SELECT c.*
FROM changeovers c
WHERE 
  c.share_token IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM accessible_properties p
    WHERE p.id = c.property_id
  );

CREATE OR REPLACE VIEW accessible_findings AS
SELECT f.*
FROM findings f
WHERE EXISTS (
  SELECT 1 FROM accessible_changeovers c
  WHERE c.id = f.changeover_id
);

-- Step 2: Create policies using views
CREATE POLICY "view_properties"
ON properties FOR SELECT
TO authenticated
USING (
  id IN (SELECT id FROM accessible_properties)
);

CREATE POLICY "view_changeovers"
ON changeovers FOR SELECT
USING (
  id IN (SELECT id FROM accessible_changeovers)
);

CREATE POLICY "view_findings"
ON findings FOR SELECT
USING (
  id IN (SELECT id FROM accessible_findings)
);

CREATE POLICY "insert_findings"
ON findings FOR INSERT
WITH CHECK (
  changeover_id IN (SELECT id FROM accessible_changeovers)
);

CREATE POLICY "update_findings"
ON findings FOR UPDATE
USING (
  id IN (SELECT id FROM accessible_findings)
  AND changeover_id IN (
    SELECT id FROM accessible_changeovers ac
    WHERE NOT EXISTS (
      SELECT 1 FROM changeovers c
      WHERE c.id = ac.id 
      AND c.share_token IS NOT NULL
    )
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT id FROM accessible_changeovers ac
    WHERE NOT EXISTS (
      SELECT 1 FROM changeovers c
      WHERE c.id = ac.id 
      AND c.share_token IS NOT NULL
    )
  )
);

-- Step 3: Create indexes for view performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);