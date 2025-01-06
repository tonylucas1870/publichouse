-- Create view for cleaner details
CREATE OR REPLACE VIEW cleaner_details AS
SELECT 
  pc.id,
  pc.property_id,
  pc.user_id,
  pc.created_at,
  pc.created_by,
  u.email as user_email
FROM property_cleaners pc
JOIN auth.users u ON u.id = pc.user_id;

-- Create policy for property cleaners table
DROP POLICY IF EXISTS "Property owners can manage cleaners" ON property_cleaners;

CREATE POLICY "manage_cleaners"
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