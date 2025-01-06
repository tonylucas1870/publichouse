-- Step 1: Drop ALL existing policies first
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_access" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;
DROP POLICY IF EXISTS "select_properties" ON properties;
DROP POLICY IF EXISTS "select_changeovers" ON changeovers;
DROP POLICY IF EXISTS "select_findings" ON findings;
DROP POLICY IF EXISTS "insert_findings" ON findings;
DROP POLICY IF EXISTS "update_findings" ON findings;

-- Step 2: Drop existing views
DROP VIEW IF EXISTS accessible_findings CASCADE;
DROP VIEW IF EXISTS accessible_changeovers CASCADE;
DROP VIEW IF EXISTS accessible_properties CASCADE;
DROP VIEW IF EXISTS owned_properties CASCADE;
DROP VIEW IF EXISTS shared_changeovers CASCADE;

-- Step 3: Create base property access view
CREATE VIEW owned_properties AS
SELECT id, created_by
FROM properties
WHERE created_by = auth.uid();

-- Step 4: Create shared changeovers view
CREATE VIEW shared_changeovers AS
SELECT id, property_id
FROM changeovers
WHERE share_token IS NOT NULL;

-- Step 5: Create accessible changeovers view
CREATE VIEW accessible_changeovers AS
SELECT c.id
FROM changeovers c
WHERE EXISTS (
    SELECT 1 FROM owned_properties p WHERE p.id = c.property_id
)
UNION
SELECT id FROM shared_changeovers;

-- Step 6: Create new policies using simplified views
CREATE POLICY "base_property_access"
ON properties FOR SELECT
TO authenticated
USING (id IN (SELECT id FROM owned_properties));

CREATE POLICY "base_changeover_access"
ON changeovers FOR SELECT
USING (id IN (SELECT id FROM accessible_changeovers));

CREATE POLICY "base_finding_select"
ON findings FOR SELECT
USING (changeover_id IN (SELECT id FROM accessible_changeovers));

CREATE POLICY "base_finding_insert"
ON findings FOR INSERT
WITH CHECK (changeover_id IN (SELECT id FROM accessible_changeovers));

CREATE POLICY "base_finding_update"
ON findings FOR UPDATE
USING (
    changeover_id IN (
        SELECT c.id 
        FROM changeovers c
        JOIN owned_properties p ON p.id = c.property_id
    )
)
WITH CHECK (
    changeover_id IN (
        SELECT c.id 
        FROM changeovers c
        JOIN owned_properties p ON p.id = c.property_id
    )
);

-- Step 7: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);