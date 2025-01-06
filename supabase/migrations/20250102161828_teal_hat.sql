-- Step 1: Create property management policies
CREATE POLICY "property_management_access"
ON properties FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
);

-- Step 2: Create room management policies
CREATE POLICY "room_management_access"
ON rooms FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = rooms.property_id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
);

CREATE POLICY "room_update_access"
ON rooms FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = rooms.property_id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = rooms.property_id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
);

CREATE POLICY "room_delete_access"
ON rooms FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = rooms.property_id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
);

-- Step 3: Create utility management policies
CREATE POLICY "utility_management_access"
ON utilities FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = utilities.property_id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = utilities.property_id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
);