-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "properties_access" ON properties;
DROP POLICY IF EXISTS "changeovers_access" ON changeovers;
DROP POLICY IF EXISTS "findings_select" ON findings;
DROP POLICY IF EXISTS "findings_insert" ON findings;
DROP POLICY IF EXISTS "findings_update" ON findings;

-- Properties: Base level, no dependencies
CREATE POLICY "base_properties_access"
ON properties FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR id IN (
    SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
  )
);

-- Changeovers: Only depends on property access
CREATE POLICY "base_changeovers_access"
ON changeovers FOR SELECT
USING (
  share_token IS NOT NULL  -- Public share token access
  OR property_id IN (     -- Property owner/cleaner access
    SELECT id FROM properties 
    WHERE created_by = auth.uid()
    OR id IN (
      SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
    )
  )
);

-- Findings: Only depends on changeover access
CREATE POLICY "base_findings_select"
ON findings FOR SELECT
USING (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
    share_token IS NOT NULL  -- Public share token access
    OR property_id IN (     -- Property owner/cleaner access
      SELECT id FROM properties 
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "base_findings_insert"
ON findings FOR INSERT
WITH CHECK (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
    share_token IS NOT NULL  -- Public share token access
    OR property_id IN (     -- Property owner/cleaner access
      SELECT id FROM properties 
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "base_findings_update"
ON findings FOR UPDATE
USING (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
    property_id IN (     -- Only property owner/cleaner can update
      SELECT id FROM properties 
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
    property_id IN (     -- Only property owner/cleaner can update
      SELECT id FROM properties 
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
      )
    )
  )
);

-- Optimize query performance with indexes
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);