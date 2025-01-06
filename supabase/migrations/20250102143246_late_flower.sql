-- Step 1: Drop all property access related objects
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;

DROP VIEW IF EXISTS property_access_details CASCADE;
DROP TYPE IF EXISTS property_access_level CASCADE;
DROP TABLE IF EXISTS property_access CASCADE;
DROP FUNCTION IF EXISTS manage_property_access CASCADE;
DROP FUNCTION IF EXISTS check_property_access CASCADE;

-- Step 2: Create simplified owner-only policies
CREATE POLICY "property_owner_access"
ON properties FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "changeover_owner_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL  -- Public share access
    OR EXISTS (              -- Property owner access
        SELECT 1 FROM properties p
        WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
);

CREATE POLICY "finding_owner_select"
ON findings FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND (
            c.share_token IS NOT NULL
            OR EXISTS (
                SELECT 1 FROM properties p
                WHERE p.id = c.property_id
                AND p.created_by = auth.uid()
            )
        )
    )
);

CREATE POLICY "finding_owner_insert"
ON findings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM changeovers c
        JOIN properties p ON p.id = c.property_id
        WHERE c.id = changeover_id
        AND (
            c.share_token IS NOT NULL
            OR p.created_by = auth.uid()
        )
    )
);

-- Step 3: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);