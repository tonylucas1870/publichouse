-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "property_select_policy" ON properties;
DROP POLICY IF EXISTS "changeover_select_policy" ON changeovers;
DROP POLICY IF EXISTS "finding_select_policy" ON findings;
DROP POLICY IF EXISTS "finding_insert_policy" ON findings;
DROP POLICY IF EXISTS "finding_update_policy" ON findings;

-- Step 2: Enable RLS on properties table
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Step 3: Create property access policy
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()  -- Property owner
    OR EXISTS (              -- User with granted access
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level IN ('cleaner', 'maintenance', 'admin')
    )
);

-- Step 4: Create changeover access policy
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
            OR (pa.user_id = auth.uid() AND pa.access_level IN ('cleaner', 'maintenance', 'admin'))
        )
    )
);

-- Step 5: Create finding policies
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
                    OR (pa.user_id = auth.uid() AND pa.access_level IN ('cleaner', 'maintenance', 'admin'))
                )
            )
        )
    )
);

-- Step 6: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_property_access_composite 
ON property_access(property_id, user_id, access_level);