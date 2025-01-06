-- Create temporary table to store data
CREATE TEMP TABLE room_details_backup AS 
SELECT * FROM room_details;

-- Drop existing table
DROP TABLE room_details;

-- Create new table with contents column
CREATE TABLE room_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  contents jsonb DEFAULT '[]'::jsonb,
  walls jsonb DEFAULT '[]'::jsonb,
  lighting jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(room_id)
);

-- Restore data with proper column names
INSERT INTO room_details (
  id,
  room_id,
  contents,
  walls,
  lighting,
  created_at,
  updated_at
)
SELECT 
  id,
  room_id,
  COALESCE(furniture, '[]'::jsonb) as contents,
  COALESCE(walls, '[]'::jsonb),
  COALESCE(lighting, '[]'::jsonb),
  created_at,
  updated_at
FROM room_details_backup;

-- Drop temporary table
DROP TABLE room_details_backup;