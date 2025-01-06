/*
  # Add rooms management

  1. New Tables
    - `rooms`
      - `id` (uuid, primary key)
      - `name` (text, room name)
      - `property_id` (uuid, reference to properties)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on rooms table
    - Add policies for authenticated users
    - Add policy for public access to rooms for shared changeovers
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  property_id uuid REFERENCES properties(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, name)
);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view rooms for their properties"
ON rooms FOR SELECT
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can create rooms for their properties"
ON rooms FOR INSERT
TO authenticated
WITH CHECK (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);

-- Policy for public access via changeover share token
CREATE POLICY "Anyone can view rooms for shared changeovers"
ON rooms FOR SELECT
TO public
USING (
  property_id IN (
    SELECT property_id 
    FROM changeovers 
    WHERE share_token IS NOT NULL
  )
);