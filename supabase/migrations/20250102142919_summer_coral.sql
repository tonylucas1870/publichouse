-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "property_base_access" ON properties;
DROP POLICY IF EXISTS "changeover_base_access" ON changeovers;
DROP POLICY IF EXISTS "finding_base_select" ON findings;
DROP POLICY IF EXISTS "finding_base_insert" ON findings;

-- Step 2: Create simplified property access policy
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()  -- Owner access
    OR EXISTS (              -- User with explicit access
        SELECT 1 
        FROM property_access 
        WHERE property_id = properties.id
        AND user_id = auth.uid()
    )
);

-- Step 3: Create simplified changeover access policy
CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL  -- Public share access
    OR EXISTS (              -- Property access
        SELECT 1 
        FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = changeovers.property_id
        AND (
            p.created_by = auth.uid()
            OR pa.user_id = auth.uid()
        )
    )
);

-- Step 4: Create simplified finding policies
CREATE POLICY "finding_select"
ON findings FOR SELECT
USING (
    EXISTS (
        SELECT 1 
        FROM changeovers c
        WHERE c.id = findings.changeover_id
        AND (
            c.share_token IS NOT NULL
            OR EXISTS (
                SELECT 1 
                FROM properties p
                LEFT JOIN property_access pa ON pa.property_id = p.id
                WHERE p.id = c.property_id
                AND (
                    p.created_by = auth.uid()
                    OR pa.user_id = auth.uid()
                )
            )
        )
    )
);

CREATE POLICY "finding_insert"
ON findings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM changeovers c
        JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE c.id = changeover_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level IN ('write', 'admin'))
        )
    )
);

-- Step 5: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_property_access_user_id ON property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property_id ON property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_property_access_level ON property_access(access_level);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);