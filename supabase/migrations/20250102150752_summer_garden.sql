-- Step 1: Drop ALL existing policies first
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;
DROP POLICY IF EXISTS "access_property" ON properties;
DROP POLICY IF EXISTS "access_changeover" ON changeovers;
DROP POLICY IF EXISTS "access_finding" ON findings;
DROP POLICY IF EXISTS "write_finding" ON findings;
DROP POLICY IF EXISTS "update_finding" ON findings;
DROP POLICY IF EXISTS "view_access" ON property_access;
DROP POLICY IF EXISTS "manage_access" ON property_access;

-- Step 2: Create property access table policies
CREATE POLICY "property_access_view"
ON property_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "property_access_manage"
ON property_access FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = property_id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = property_id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
);

-- Step 3: Create property policies
CREATE POLICY "property_base_access"
ON properties FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT property_id FROM property_access
        WHERE user_id = auth.uid()
    )
);

-- Step 4: Create changeover policies
CREATE POLICY "changeover_base_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL
    OR property_id IN (
        SELECT property_id FROM property_access
        WHERE user_id = auth.uid()
    )
);

-- Step 5: Create finding policies
CREATE POLICY "finding_base_select"
ON findings FOR SELECT
USING (
    changeover_id IN (
        SELECT c.id FROM changeovers c
        WHERE c.share_token IS NOT NULL
        OR c.property_id IN (
            SELECT property_id FROM property_access
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "finding_base_insert"
ON findings FOR INSERT
WITH CHECK (
    changeover_id IN (
        SELECT c.id FROM changeovers c
        WHERE c.share_token IS NOT NULL
        OR c.property_id IN (
            SELECT property_id FROM property_access
            WHERE user_id = auth.uid()
            AND access_level IN ('write', 'admin')
        )
    )
);

CREATE POLICY "finding_base_update"
ON findings FOR UPDATE
USING (
    changeover_id IN (
        SELECT c.id FROM changeovers c
        WHERE c.property_id IN (
            SELECT property_id FROM property_access
            WHERE user_id = auth.uid()
            AND access_level IN ('write', 'admin')
        )
    )
)
WITH CHECK (
    changeover_id IN (
        SELECT c.id FROM changeovers c
        WHERE c.property_id IN (
            SELECT property_id FROM property_access
            WHERE user_id = auth.uid()
            AND access_level IN ('write', 'admin')
        )
    )
);

-- Step 6: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_property_access_user_id ON property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property_id ON property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_property_access_level ON property_access(access_level);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);