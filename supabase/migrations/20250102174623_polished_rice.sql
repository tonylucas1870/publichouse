-- Step 1: Create policy to allow property access through property_access table
CREATE POLICY "access_through_property_access"
ON properties FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT property_id FROM property_access
        WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
);

-- Step 2: Create index to optimize the property access lookup
CREATE INDEX IF NOT EXISTS idx_property_access_lookup 
ON property_access(user_id, property_id);