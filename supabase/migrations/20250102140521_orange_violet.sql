-- Step 1: Drop existing policies and views with CASCADE
DROP VIEW IF EXISTS accessible_findings CASCADE;
DROP VIEW IF EXISTS accessible_changeovers CASCADE;
DROP VIEW IF EXISTS accessible_properties CASCADE;
DROP VIEW IF EXISTS cleaner_details CASCADE;

-- Step 2: Drop cleaner-related objects
DROP TABLE IF EXISTS property_cleaners CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_email CASCADE;

-- Step 3: Create simplified views for access control
CREATE VIEW accessible_properties AS
SELECT p.*
FROM properties p
WHERE p.created_by = auth.uid();

CREATE VIEW accessible_changeovers AS
SELECT c.*
FROM changeovers c
WHERE 
  c.share_token IS NOT NULL  -- Public share access
  OR c.property_id IN (SELECT id FROM accessible_properties);

CREATE VIEW accessible_findings AS
SELECT f.*
FROM findings f
WHERE f.changeover_id IN (SELECT id FROM accessible_changeovers);

-- Step 4: Create simplified policies
CREATE POLICY "select_properties"
ON properties FOR SELECT
TO authenticated
USING (id IN (SELECT id FROM accessible_properties));

CREATE POLICY "select_changeovers"
ON changeovers FOR SELECT
USING (id IN (SELECT id FROM accessible_changeovers));

CREATE POLICY "select_findings"
ON findings FOR SELECT
USING (id IN (SELECT id FROM accessible_findings));

CREATE POLICY "insert_findings"
ON findings FOR INSERT
WITH CHECK (changeover_id IN (SELECT id FROM accessible_changeovers));

CREATE POLICY "update_findings"
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

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);