/*
  # Fix room details data structure

  1. Changes
    - Ensure walls and lighting are arrays instead of objects
    - Migrate existing data to array format
    - Add constraints to ensure proper data structure

  2. Data Migration
    - Convert any object data to arrays
    - Preserve existing data where possible
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

-- Add constraints to ensure arrays
ALTER TABLE room_details
ADD CONSTRAINT furniture_is_array CHECK (jsonb_typeof(furniture) = 'array'),
ADD CONSTRAINT walls_is_array CHECK (jsonb_typeof(walls) = 'array'),
ADD CONSTRAINT lighting_is_array CHECK (jsonb_typeof(lighting) = 'array');

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
  CASE 
    WHEN jsonb_typeof(furniture) = 'array' THEN furniture
    ELSE '[]'::jsonb
  END,
  CASE 
    WHEN jsonb_typeof(walls) = 'array' THEN walls
    WHEN jsonb_typeof(walls) = 'object' THEN 
      (SELECT jsonb_agg(v) FROM jsonb_each(walls) AS t(k,v))
    ELSE '[]'::jsonb
  END,
  CASE 
    WHEN jsonb_typeof(lighting) = 'array' THEN lighting
    WHEN jsonb_typeof(lighting) = 'object' THEN 
      (SELECT jsonb_agg(v) FROM jsonb_each(lighting) AS t(k,v))
    ELSE '[]'::jsonb
  END,
  created_at,
  updated_at
FROM room_details_backup;

-- Drop temporary table
DROP TABLE room_details_backup;

-- Enable RLS
ALTER TABLE room_details ENABLE ROW LEVEL SECURITY;

-- Recreate policies
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

-- Recreate trigger for updated_at
CREATE OR REPLACE FUNCTION update_room_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_room_details_timestamp
  BEFORE UPDATE ON room_details
  FOR EACH ROW
  EXECUTE FUNCTION update_room_details_updated_at();