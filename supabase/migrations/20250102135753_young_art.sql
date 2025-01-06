/*
  # Fix cleaner access policies

  1. Changes
    - Simplify access control by using direct table policies
    - Remove dependency on views
    - Add proper indexes for performance
    - Ensure cleaners can access assigned properties and related data

  2. Security
    - Maintain strict access control
    - Only allow access to authorized users
    - Prevent unauthorized data access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;

-- Properties: Base level access
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR id IN (
    SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
  )
);

-- Changeovers: Depends on property access
CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
  share_token IS NOT NULL
  OR property_id IN (
    SELECT id FROM properties WHERE
      created_by = auth.uid()
      OR id IN (SELECT property_id FROM property_cleaners WHERE user_id = auth.uid())
  )
);

-- Findings: Depends on changeover access
CREATE POLICY "finding_select"
ON findings FOR SELECT
USING (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
      share_token IS NOT NULL
      OR property_id IN (
        SELECT id FROM properties WHERE
          created_by = auth.uid()
          OR id IN (SELECT property_id FROM property_cleaners WHERE user_id = auth.uid())
      )
  )
);

CREATE POLICY "finding_insert"
ON findings FOR INSERT
WITH CHECK (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
      share_token IS NOT NULL
      OR property_id IN (
        SELECT id FROM properties WHERE
          created_by = auth.uid()
          OR id IN (SELECT property_id FROM property_cleaners WHERE user_id = auth.uid())
      )
  )
);

CREATE POLICY "finding_update"
ON findings FOR UPDATE
USING (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
      property_id IN (
        SELECT id FROM properties WHERE
          created_by = auth.uid()
          OR id IN (SELECT property_id FROM property_cleaners WHERE user_id = auth.uid())
      )
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
      property_id IN (
        SELECT id FROM properties WHERE
          created_by = auth.uid()
          OR id IN (SELECT property_id FROM property_cleaners WHERE user_id = auth.uid())
      )
  )
);

-- Ensure proper indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);