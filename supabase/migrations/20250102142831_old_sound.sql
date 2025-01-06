-- Step 1: Drop existing policies to start fresh
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_access" ON findings;
DROP POLICY IF EXISTS "finding_write_access" ON findings;

-- Step 2: Create simplified property access policy
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()  -- Owner access
    OR id IN (               -- User with explicit access
        SELECT property_id 
        FROM property_access 
        WHERE user_id = auth.uid()
    )
);

-- Step 3: Create changeover access policy
CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL  -- Public share access
    OR property_id IN (      -- Property access
        SELECT id FROM properties WHERE
            created_by = auth.uid()  -- Owner
        UNION
        SELECT property_id FROM property_access 
        WHERE user_id = auth.uid()   -- User with access
    )
);

-- Step 4: Create finding access policies
CREATE POLICY "finding_select"
ON findings FOR SELECT
USING (
    changeover_id IN (
        SELECT id FROM changeovers WHERE
            share_token IS NOT NULL  -- Public share access
            OR property_id IN (      -- Property access
                SELECT id FROM properties WHERE
                    created_by = auth.uid()  -- Owner
                UNION
                SELECT property_id FROM property_access 
                WHERE user_id = auth.uid()   -- User with access
            )
    )
);

-- Write access only for owners and users with write/admin access
CREATE POLICY "finding_insert"
ON findings FOR INSERT
WITH CHECK (
    changeover_id IN (
        SELECT id FROM changeovers WHERE
            property_id IN (
                SELECT id FROM properties WHERE
                    created_by = auth.uid()  -- Owner
                UNION
                SELECT property_id FROM property_access 
                WHERE user_id = auth.uid()
                AND access_level IN ('write', 'admin')  -- Write access required
            )
    )
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_property_access_composite 
ON property_access(user_id, property_id, access_level);