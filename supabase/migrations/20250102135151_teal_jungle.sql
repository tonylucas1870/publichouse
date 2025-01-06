/*
  # Add Access Control Views
  
  This migration creates views to simplify access control by:
  1. Creating a view for accessible properties
  2. Creating a view for accessible changeovers
  3. Creating a view for accessible findings
  4. Using views in RLS policies to avoid recursion
*/

-- Step 1: Create view for accessible properties
CREATE OR REPLACE VIEW accessible_properties AS
SELECT p.*
FROM properties p
WHERE EXISTS (
  SELECT 1 
  FROM auth.users u
  LEFT JOIN property_cleaners pc ON pc.property_id = p.id AND pc.user_id = u.id
  WHERE u.id = auth.uid() 
  AND (p.created_by = u.id OR pc.id IS NOT NULL)
);

-- Step 2: Create view for accessible changeovers
CREATE OR REPLACE VIEW accessible_changeovers AS
SELECT c.*
FROM changeovers c
WHERE c.share_token IS NOT NULL
OR EXISTS (
  SELECT 1 
  FROM accessible_properties p
  WHERE p.id = c.property_id
);

-- Step 3: Create view for accessible findings
CREATE OR REPLACE VIEW accessible_findings AS
SELECT f.*
FROM findings f
WHERE EXISTS (
  SELECT 1 
  FROM accessible_changeovers c
  WHERE c.id = f.changeover_id
);

-- Step 4: Drop existing policies
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;

-- Step 5: Create simplified policies using views
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
  id IN (SELECT id FROM accessible_properties)
);

CREATE POLICY "changeover_access"
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

-- Step 6: Create indexes for view performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);