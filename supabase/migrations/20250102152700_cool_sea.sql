-- Step 1: Drop existing property policies
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "property_base_access" ON properties;

-- Step 2: Create comprehensive property access policy
CREATE POLICY "property_access_policy"
ON properties FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()  -- Property owner
    OR EXISTS (              -- User with granted access
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
    )
);

-- Step 3: Create property update policy
CREATE POLICY "property_update_policy"
ON properties FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid()  -- Property owner
    OR EXISTS (              -- Admin access
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
)
WITH CHECK (
    created_by = auth.uid()  -- Property owner
    OR EXISTS (              -- Admin access
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
);

-- Step 4: Create optimized index for property owner lookup
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);