/*
  # Add room deletion policy

  1. Changes
    - Add RLS policy to allow room deletion for property owners
  
  2. Security
    - Only property owners can delete rooms from their properties
*/

-- Add delete policy for rooms
CREATE POLICY "Users can delete rooms for their properties"
ON rooms FOR DELETE
TO authenticated
USING (
  property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
);