-- Step 1: Drop existing property policies
DROP POLICY IF EXISTS "mv_property_access" ON properties;
DROP POLICY IF EXISTS "property_select" ON properties;
DROP POLICY IF EXISTS "base_property_access" ON properties;

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

-- Step 3: Create policy for property updates
CREATE POLICY "property_update_policy"
ON properties FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level IN ('write', 'admin')
    )
)
WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level IN ('write', 'admin')
    )
);

-- Step 4: Create view for property access details
CREATE OR REPLACE VIEW property_access_details AS
SELECT 
    pa.id,
    pa.property_id,
    pa.user_id,
    pa.access_level,
    pa.created_at,
    pa.created_by,
    u.email as user_email,
    p.name as property_name
FROM property_access pa
JOIN auth.users u ON u.id = pa.user_id
JOIN properties p ON p.id = pa.property_id;

-- Step 5: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_property_access_composite 
ON property_access(property_id, user_id, access_level);

-- Step 6: Add property access check function
CREATE OR REPLACE FUNCTION check_property_access(
    property_id uuid,
    required_level property_access_level DEFAULT 'read'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id 
            AND pa.user_id = auth.uid()
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR (
                pa.access_level IS NOT NULL 
                AND CASE 
                    WHEN required_level = 'read' THEN true
                    WHEN required_level = 'write' THEN pa.access_level IN ('write', 'admin')
                    WHEN required_level = 'admin' THEN pa.access_level = 'admin'
                END
            )
        )
    );
END;
$$;