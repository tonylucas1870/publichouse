-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;

-- Step 2: Create base property access policy
CREATE POLICY "property_base_access"
ON properties FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()
    OR id IN (
        SELECT property_id 
        FROM property_access 
        WHERE user_id = auth.uid()
    )
);

-- Step 3: Create base changeover access policy
CREATE POLICY "changeover_base_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL
    OR property_id IN (
        SELECT id 
        FROM properties 
        WHERE created_by = auth.uid()
        OR id IN (
            SELECT property_id 
            FROM property_access 
            WHERE user_id = auth.uid()
        )
    )
);

-- Step 4: Create base finding policies
CREATE POLICY "finding_base_select"
ON findings FOR SELECT
USING (
    EXISTS (
        SELECT 1 
        FROM changeovers c
        WHERE c.id = changeover_id
        AND (
            c.share_token IS NOT NULL
            OR c.property_id IN (
                SELECT id 
                FROM properties 
                WHERE created_by = auth.uid()
                OR id IN (
                    SELECT property_id 
                    FROM property_access 
                    WHERE user_id = auth.uid()
                )
            )
        )
    )
);

CREATE POLICY "finding_base_insert"
ON findings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM changeovers c
        WHERE c.id = changeover_id
        AND c.property_id IN (
            SELECT id 
            FROM properties 
            WHERE created_by = auth.uid()
            OR id IN (
                SELECT property_id 
                FROM property_access 
                WHERE user_id = auth.uid()
                AND access_level IN ('write', 'admin')
            )
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