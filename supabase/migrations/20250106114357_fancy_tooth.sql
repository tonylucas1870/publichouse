-- Refresh all materialized views that might reference room_details
REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_property_access;
REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_owned_properties;
REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS mv_shared_changeovers;

-- Drop and recreate room_details policies to force query plan refresh
DROP POLICY IF EXISTS "Users can view room details for their properties" ON room_details;
DROP POLICY IF EXISTS "Users can update room details for their properties" ON room_details;
DROP POLICY IF EXISTS "Users can insert room details for their properties" ON room_details;

CREATE POLICY "room_details_select"
ON room_details FOR SELECT
TO authenticated
USING (
  room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON r.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
);

CREATE POLICY "room_details_update"
ON room_details FOR UPDATE
TO authenticated
USING (
  room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON r.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
)
WITH CHECK (
  room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON r.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
);

CREATE POLICY "room_details_insert"
ON room_details FOR INSERT
TO authenticated
WITH CHECK (
  room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON r.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
);

-- Force statistics update on room_details table
ANALYZE room_details;