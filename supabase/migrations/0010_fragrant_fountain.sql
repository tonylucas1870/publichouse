/*
  # Room Details Schema

  1. New Tables
    - `room_details`: Stores detailed information about rooms
      - `id` (uuid, primary key)
      - `room_id` (uuid, references rooms)
      - `furniture` (jsonb)
      - `walls` (jsonb)
      - `lighting` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create room_details table
CREATE TABLE IF NOT EXISTS room_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  furniture jsonb DEFAULT '[]'::jsonb,
  walls jsonb DEFAULT '{}'::jsonb,
  lighting jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(room_id)
);

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

-- Create trigger to update updated_at
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