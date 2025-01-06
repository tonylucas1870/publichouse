/*
  # Update room details schema for multiple walls and lighting items

  1. Changes
    - Drop existing constraints and triggers
    - Create temporary table to store data
    - Recreate table with new structure
    - Restore data with proper array format
    - Add new constraints and triggers

  2. Schema
    - walls: Array of objects with:
      - id: Unique identifier
      - color: Paint color
      - notes: Additional notes
      - location: Wall location/description
    - lighting: Array of objects with:
      - id: Unique identifier
      - fixture: Fixture type/description
      - notes: Additional notes
      - location: Fixture location
*/

-- Create temporary table to store data
CREATE TEMP TABLE room_details_backup AS 
SELECT * FROM room_details;

-- Drop existing table
DROP TABLE room_details;

-- Recreate table with proper defaults
CREATE TABLE room_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  furniture jsonb DEFAULT '[]'::jsonb,
  walls jsonb DEFAULT '[]'::jsonb,
  lighting jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(room_id)
);

-- Restore data with proper array format
INSERT INTO room_details (
  id,
  room_id,
  furniture,
  walls,
  lighting,
  created_at,
  updated_at
)
SELECT 
  id,
  room_id,
  furniture,
  CASE 
    WHEN walls = '{}'::jsonb THEN '[]'::jsonb
    ELSE walls
  END,
  CASE 
    WHEN lighting = '{}'::jsonb THEN '[]'::jsonb
    ELSE lighting
  END,
  created_at,
  updated_at
FROM room_details_backup;

-- Drop temporary table
DROP TABLE room_details_backup;

-- Enable RLS
ALTER TABLE room_details ENABLE ROW LEVEL SECURITY;

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

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_room_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_room_details_timestamp
  BEFORE UPDATE ON room_details
  FOR EACH ROW
  EXECUTE FUNCTION update_room_details_updated_at();