/*
  # Update room details schema for contents - Part 2

  1. Changes
    - Create backup of room_details table
    - Drop existing table
    - Create new table with contents column
*/

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