/*
  # Update room details policies
  
  1. Changes
    - Enable RLS on room_details table
    - Create policies for viewing, updating, and inserting room details
*/

-- Enable RLS
ALTER TABLE room_details ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view room details for their properties" ON room_details;
DROP POLICY IF EXISTS "Users can update room details for their properties" ON room_details;
DROP POLICY IF EXISTS "Users can insert room details for their properties" ON room_details;

-- Create policies
CREATE POLICY "Users can view room details for their properties"
ON room_details FOR SELECT
TO authenticated
USING (
  room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON r.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update room details for their properties"
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

CREATE POLICY "Users can insert room details for their properties"
ON room_details FOR INSERT
TO authenticated
WITH CHECK (
  room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON r.property_id = p.id
    WHERE p.created_by = auth.uid()
  )
);