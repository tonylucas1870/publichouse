/*
  # Fix Database Policies Using Views
  
  1. Changes
    - Drop existing policies
    - Create views for access control
    - Create new policies using views
    - Add proper indexes
    
  2. Security
    - Maintain strict access control
    - Prevent infinite recursion
    - Support property owners and cleaners
*/

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;
DROP POLICY IF EXISTS "property_select" ON properties;
DROP POLICY IF EXISTS "changeover_select" ON changeovers;

-- Step 2: Drop existing views if they exist
DROP VIEW IF EXISTS accessible_findings;
DROP VIEW IF EXISTS accessible_changeovers;
DROP VIEW IF EXISTS accessible_properties;

-- Step 3: Create base view for property access
CREATE OR REPLACE VIEW accessible_properties AS
SELECT p.*
FROM properties p
WHERE 
  p.created_by = auth.uid()  -- Property owner
  OR EXISTS (
    SELECT 1 FROM property_cleaners pc
    WHERE pc.property_id = p.id
    AND pc.user_id = auth.uid()  -- Property cleaner
  );

-- Step 4: Create view for changeover access
CREATE OR REPLACE VIEW accessible_changeovers AS
SELECT c.*
FROM changeovers c
WHERE 
  c.share_token IS NOT NULL  -- Public share access
  OR EXISTS (
    SELECT 1 FROM accessible_properties p
    WHERE p.id = c.property_id
  );

-- Step 5: Create view for findings access
CREATE OR REPLACE VIEW accessible_findings AS
SELECT f.*
FROM findings f
WHERE EXISTS (
  SELECT 1 FROM accessible_changeovers c
  WHERE c.id = f.changeover_id
);

-- Step 6: Create simplified policies using views
CREATE POLICY "property_select"
ON properties FOR SELECT
TO authenticated
USING (
  id IN (SELECT id FROM accessible_properties)
);

CREATE POLICY "changeover_select"
ON changeovers FOR SELECT
USING (
  id IN (SELECT id FROM accessible_changeovers)
);

CREATE POLICY "finding_select"
ON findings FOR SELECT
USING (
  id IN (SELECT id FROM accessible_findings)
);

CREATE POLICY "finding_insert"
ON findings FOR INSERT
WITH CHECK (
  changeover_id IN (SELECT id FROM accessible_changeovers)
);

CREATE POLICY "finding_update"
ON findings FOR UPDATE
USING (
  id IN (SELECT id FROM accessible_findings)
  AND changeover_id IN (
    SELECT id FROM accessible_changeovers ac
    WHERE NOT EXISTS (
      SELECT 1 FROM changeovers c
      WHERE c.id = ac.id AND c.share_token IS NOT NULL
    )
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT id FROM accessible_changeovers ac
    WHERE NOT EXISTS (
      SELECT 1 FROM changeovers c
      WHERE c.id = ac.id AND c.share_token IS NOT NULL
    )
  )
);

-- Step 7: Create indexes for view performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);