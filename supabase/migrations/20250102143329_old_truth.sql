-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "property_owner_access" ON properties;
DROP POLICY IF EXISTS "changeover_owner_access" ON changeovers;
DROP POLICY IF EXISTS "finding_owner_select" ON findings;
DROP POLICY IF EXISTS "finding_owner_insert" ON findings;

-- Step 2: Create simple direct property access policy
CREATE POLICY "owner_access"
ON properties FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Step 3: Create changeover access policy
CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL
    OR property_id IN (
        SELECT id FROM properties 
        WHERE created_by = auth.uid()
    )
);

-- Step 4: Create finding policies
CREATE POLICY "finding_select"
ON findings FOR SELECT
USING (
    changeover_id IN (
        SELECT id FROM changeovers
        WHERE share_token IS NOT NULL
        OR property_id IN (
            SELECT id FROM properties 
            WHERE created_by = auth.uid()
        )
    )
);

CREATE POLICY "finding_insert"
ON findings FOR INSERT
WITH CHECK (
    changeover_id IN (
        SELECT id FROM changeovers
        WHERE share_token IS NOT NULL
        OR property_id IN (
            SELECT id FROM properties 
            WHERE created_by = auth.uid()
        )
    )
);

-- Step 5: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);