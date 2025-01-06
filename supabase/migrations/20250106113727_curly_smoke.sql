-- Drop existing room policies
DROP POLICY IF EXISTS "room_access" ON rooms;
DROP POLICY IF EXISTS "room_write_access" ON rooms;

-- Create room access policies
CREATE POLICY "room_select"
ON rooms FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.property_id = rooms.property_id
        AND (
            c.share_token IS NOT NULL
            OR EXISTS (
                SELECT 1 FROM properties p
                WHERE p.id = c.property_id
                AND p.created_by = auth.uid()
            )
        )
    )
);

CREATE POLICY "room_insert"
ON rooms FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.property_id = rooms.property_id
        AND (
            c.share_token IS NOT NULL
            OR EXISTS (
                SELECT 1 FROM properties p
                WHERE p.id = c.property_id
                AND p.created_by = auth.uid()
            )
        )
    )
);

-- Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_rooms_property_id ON rooms(property_id);