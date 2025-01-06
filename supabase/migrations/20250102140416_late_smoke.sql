-- Drop existing policies
DROP POLICY IF EXISTS "property_select" ON properties;
DROP POLICY IF EXISTS "changeover_select" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;

-- Simple property access
CREATE POLICY "property_select"
ON properties FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Changeover access (depends on property ownership or share token)
CREATE POLICY "changeover_select"
ON changeovers FOR SELECT
USING (
  share_token IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_id
    AND p.created_by = auth.uid()
  )
);

-- Finding access (depends on changeover access)
CREATE POLICY "finding_select"
ON findings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      c.share_token IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = c.property_id
        AND p.created_by = auth.uid()
      )
    )
  )
);

CREATE POLICY "finding_insert"
ON findings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      c.share_token IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = c.property_id
        AND p.created_by = auth.uid()
      )
    )
  )
);

CREATE POLICY "finding_update"
ON findings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = c.property_id
      AND p.created_by = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = c.property_id
      AND p.created_by = auth.uid()
    )
  )
);

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);