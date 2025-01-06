-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "property_access_select" ON property_access;
DROP POLICY IF EXISTS "property_access_manage" ON property_access;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;

-- Step 2: Create simple property access policy
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Step 3: Create simple property access table policies
CREATE POLICY "property_access_select"
ON property_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "property_access_manage"
ON property_access FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = property_id
        AND p.created_by = auth.uid()
    )
);

-- Step 4: Create simple changeover access policy
CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL
    OR property_id IN (
        SELECT id FROM properties 
        WHERE created_by = auth.uid()
    )
);

-- Step 5: Create simple finding policies
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

CREATE POLICY "finding_update"
ON findings FOR UPDATE
USING (
    changeover_id IN (
        SELECT id FROM changeovers
        WHERE property_id IN (
            SELECT id FROM properties 
            WHERE created_by = auth.uid()
        )
    )
)
WITH CHECK (
    changeover_id IN (
        SELECT id FROM changeovers
        WHERE property_id IN (
            SELECT id FROM properties 
            WHERE created_by = auth.uid()
        )
    )
);

-- Step 6: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_property_access_user_id ON property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property_id ON property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);