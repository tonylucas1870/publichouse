/*
  # Add property update functionality

  1. Changes
    - Add updated_at column to properties table
    - Add trigger for automatic timestamp updates
    - Add update policy for properties

  2. Notes
    - Uses IF NOT EXISTS for idempotent operations
    - Drops existing objects before recreation
    - Includes proper error handling
*/

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE properties 
    ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_properties_timestamp ON properties;
CREATE TRIGGER update_properties_timestamp
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_properties_updated_at();

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own properties" ON properties;

-- Create update policy
CREATE POLICY "Users can update their own properties"
  ON properties 
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());