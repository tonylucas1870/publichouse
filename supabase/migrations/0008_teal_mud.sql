/*
  # Add utilities management

  1. New Tables
    - `utilities`
      - `id` (uuid, primary key)
      - `type` (text) - Type of utility (electricity, gas, water, etc.)
      - `provider` (text) - Name of the utility provider
      - `account_number` (text, optional) - Account number with the provider
      - `notes` (text, optional) - Additional notes about the utility
      - `property_id` (uuid) - Reference to the property
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for authenticated users to manage their property utilities
*/

-- Create utilities table
CREATE TABLE IF NOT EXISTS utilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  provider text NOT NULL,
  account_number text,
  notes text,
  property_id uuid REFERENCES properties(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE utilities ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view utilities for their properties"
ON utilities FOR SELECT
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can create utilities for their properties"
ON utilities FOR INSERT
TO authenticated
WITH CHECK (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can update utilities for their properties"
ON utilities FOR UPDATE
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
)
WITH CHECK (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete utilities for their properties"
ON utilities FOR DELETE
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);