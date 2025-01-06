-- Drop existing findings policies
DROP POLICY IF EXISTS "Property owners can view findings" ON findings;
DROP POLICY IF EXISTS "Shared changeover viewers can view findings" ON findings;
DROP POLICY IF EXISTS "Property owners can create findings" ON findings;
DROP POLICY IF EXISTS "Shared changeover viewers can create findings" ON findings;
DROP POLICY IF EXISTS "Property owners can update findings" ON findings;

-- Create new policies with stricter access control
CREATE POLICY "Property owners can view findings"
ON findings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id = findings.changeover_id
    AND p.created_by = auth.uid()
  )
);

CREATE POLICY "Shared changeover viewers can view findings"
ON findings FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM changeovers c
    WHERE c.id = findings.changeover_id
    AND c.share_token IS NOT NULL
  )
);

CREATE POLICY "Property owners can create findings"
ON findings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id = changeover_id
    AND p.created_by = auth.uid()
  )
);

CREATE POLICY "Shared changeover viewers can create findings"
ON findings FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM changeovers c
    WHERE c.id = changeover_id
    AND c.share_token IS NOT NULL
  )
);

CREATE POLICY "Property owners can update findings"
ON findings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id = findings.changeover_id
    AND p.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id = findings.changeover_id
    AND p.created_by = auth.uid()
  )
);

-- Add indexes to improve policy performance
CREATE INDEX IF NOT EXISTS findings_changeover_id_idx ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS changeovers_property_id_idx ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS properties_created_by_idx ON properties(created_by);