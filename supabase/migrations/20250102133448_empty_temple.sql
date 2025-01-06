/*
  # Add cleaners functionality
  
  1. New Tables
    - `property_cleaners`
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `user_id` (uuid, references auth users)
      - `created_at` (timestamp)
      - `created_by` (uuid, references auth users)

  2. Security
    - Enable RLS on property_cleaners table
    - Add policies for property owners to manage cleaners
    - Add policies for cleaners to view assigned properties
*/

-- Create property cleaners table
CREATE TABLE IF NOT EXISTS property_cleaners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(property_id, user_id)
);

-- Enable RLS
ALTER TABLE property_cleaners ENABLE ROW LEVEL SECURITY;

-- Property owners can manage cleaners
CREATE POLICY "Property owners can manage cleaners"
ON property_cleaners
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_id
    AND p.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_id
    AND p.created_by = auth.uid()
  )
);

-- Update changeover policies to allow cleaner access
CREATE POLICY "Cleaners can view assigned changeovers"
ON changeovers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM property_cleaners pc
    WHERE pc.property_id = changeovers.property_id
    AND pc.user_id = auth.uid()
  )
);

-- Update findings policies to allow cleaner access
CREATE POLICY "Cleaners can view findings"
ON findings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM changeovers c
    JOIN property_cleaners pc ON pc.property_id = c.property_id
    WHERE c.id = findings.changeover_id
    AND pc.user_id = auth.uid()
  )
);

CREATE POLICY "Cleaners can create findings"
ON findings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM changeovers c
    JOIN property_cleaners pc ON pc.property_id = c.property_id
    WHERE c.id = changeover_id
    AND pc.user_id = auth.uid()
  )
);

-- Add indexes for performance
CREATE INDEX property_cleaners_property_id_idx ON property_cleaners(property_id);
CREATE INDEX property_cleaners_user_id_idx ON property_cleaners(user_id);