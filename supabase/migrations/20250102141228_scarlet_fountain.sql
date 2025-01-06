-- Step 1: Drop ALL existing policies first
DROP POLICY IF EXISTS "base_property_access" ON properties;
DROP POLICY IF EXISTS "base_changeover_access" ON changeovers;
DROP POLICY IF EXISTS "base_finding_select" ON findings;
DROP POLICY IF EXISTS "base_finding_insert" ON findings;
DROP POLICY IF EXISTS "base_finding_update" ON findings;
DROP POLICY IF EXISTS "property_select" ON properties;
DROP POLICY IF EXISTS "changeover_select" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;

-- Step 2: Drop existing views and materialized views
DROP VIEW IF EXISTS accessible_findings CASCADE;
DROP VIEW IF EXISTS accessible_changeovers CASCADE;
DROP VIEW IF EXISTS accessible_properties CASCADE;
DROP VIEW IF EXISTS owned_properties CASCADE;
DROP VIEW IF EXISTS shared_changeovers CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_owned_properties CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_shared_changeovers CASCADE;

-- Step 3: Create materialized views for base access
CREATE MATERIALIZED VIEW mv_owned_properties AS
SELECT id, created_by
FROM properties;

CREATE MATERIALIZED VIEW mv_shared_changeovers AS
SELECT id, property_id
FROM changeovers
WHERE share_token IS NOT NULL;

-- Step 4: Create indexes on materialized views
CREATE INDEX idx_mv_owned_properties_created_by ON mv_owned_properties(created_by);
CREATE INDEX idx_mv_shared_changeovers_property_id ON mv_shared_changeovers(property_id);

-- Step 5: Create regular view for changeover access
CREATE VIEW accessible_changeovers AS
SELECT c.id
FROM changeovers c
WHERE EXISTS (
    SELECT 1 FROM mv_owned_properties p 
    WHERE p.id = c.property_id 
    AND p.created_by = auth.uid()
)
OR EXISTS (
    SELECT 1 FROM mv_shared_changeovers s 
    WHERE s.id = c.id
);

-- Step 6: Create new policies with unique names
CREATE POLICY "mv_property_access"
ON properties FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT id FROM mv_owned_properties 
        WHERE created_by = auth.uid()
    )
);

CREATE POLICY "mv_changeover_access"
ON changeovers FOR SELECT
USING (id IN (SELECT id FROM accessible_changeovers));

CREATE POLICY "mv_finding_select"
ON findings FOR SELECT
USING (changeover_id IN (SELECT id FROM accessible_changeovers));

CREATE POLICY "mv_finding_insert"
ON findings FOR INSERT
WITH CHECK (changeover_id IN (SELECT id FROM accessible_changeovers));

CREATE POLICY "mv_finding_update"
ON findings FOR UPDATE
USING (
    changeover_id IN (
        SELECT c.id 
        FROM changeovers c
        JOIN mv_owned_properties p ON p.id = c.property_id
        WHERE p.created_by = auth.uid()
    )
)
WITH CHECK (
    changeover_id IN (
        SELECT c.id 
        FROM changeovers c
        JOIN mv_owned_properties p ON p.id = c.property_id
        WHERE p.created_by = auth.uid()
    )
);

-- Step 7: Create refresh function
CREATE OR REPLACE FUNCTION refresh_access_views()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_owned_properties;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_shared_changeovers;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create triggers to refresh materialized views
CREATE TRIGGER refresh_owned_properties_trigger
    AFTER INSERT OR UPDATE OR DELETE ON properties
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_access_views();

CREATE TRIGGER refresh_shared_changeovers_trigger
    AFTER INSERT OR UPDATE OR DELETE ON changeovers
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_access_views();

-- Step 9: Create remaining indexes
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);