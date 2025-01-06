-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_access" ON findings;
DROP POLICY IF EXISTS "finding_write_access" ON findings;

-- Step 2: Create property access policies
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()  -- Owner access
    OR EXISTS (              -- User with any level of access
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
    )
);

-- Step 3: Create policies for changeovers based on property access
CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL  -- Public share access
    OR EXISTS (              -- Property access
        SELECT 1 FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level IN ('read', 'write', 'admin'))
        )
    )
);

-- Step 4: Create policies for findings based on changeover access
CREATE POLICY "finding_access"
ON findings FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND (
            c.share_token IS NOT NULL
            OR EXISTS (
                SELECT 1 FROM properties p
                LEFT JOIN property_access pa ON pa.property_id = p.id
                WHERE p.id = c.property_id
                AND (
                    p.created_by = auth.uid()
                    OR (pa.user_id = auth.uid() AND pa.access_level IN ('read', 'write', 'admin'))
                )
            )
        )
    )
);

-- Step 5: Create write policies for findings
CREATE POLICY "finding_write_access"
ON findings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM changeovers c
        JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE c.id = changeover_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level IN ('write', 'admin'))
        )
    )
);

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_property_access_user_id ON property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property_id ON property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_property_access_level ON property_access(access_level);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;