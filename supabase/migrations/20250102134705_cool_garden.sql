/*
  # Fix RLS Policy Hierarchy

  This migration fixes the infinite recursion issues in RLS policies by:
  1. Establishing a clear hierarchy
  2. Using simpler IN clauses instead of EXISTS
  3. Avoiding circular dependencies
  4. Optimizing query performance
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "base_properties_access" ON properties;
DROP POLICY IF EXISTS "base_changeovers_access" ON changeovers;
DROP POLICY IF EXISTS "base_findings_select" ON findings;
DROP POLICY IF EXISTS "base_findings_insert" ON findings;
DROP POLICY IF EXISTS "base_findings_update" ON findings;

-- Step 1: Property Access (Base Level)
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR id IN (
    SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
  )
);

-- Step 2: Changeover Access (Depends on Properties)
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

-- Step 3: Finding Access (Depends on Changeovers)
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

-- Ensure all necessary indexes exist for performance
DROP INDEX IF EXISTS idx_properties_created_by;
DROP INDEX IF EXISTS idx_changeovers_property_id;
DROP INDEX IF EXISTS idx_changeovers_share_token;
DROP INDEX IF EXISTS idx_findings_changeover_id;
DROP INDEX IF EXISTS idx_property_cleaners_user_id;
DROP INDEX IF EXISTS idx_property_cleaners_property_id;

CREATE INDEX idx_properties_created_by ON properties(created_by);
CREATE INDEX idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX idx_property_cleaners_property_id ON property_cleaners(property_id);