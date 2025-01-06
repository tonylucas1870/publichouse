/*
  # Final RLS Policy Fix
  
  1. Changes
    - Simplify all policies to prevent recursion
    - Optimize query performance
    - Add proper indexes
    
  2. Security
    - Maintain proper access control
    - Support property owners, cleaners, and shared access
*/

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view their properties" ON properties;
DROP POLICY IF EXISTS "Users can view changeovers" ON changeovers;
DROP POLICY IF EXISTS "Access findings" ON findings;

-- Properties policies (base table, no recursion needed)
CREATE POLICY "Access properties"
ON properties FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR id IN (
    SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
  )
);

-- Changeovers policies (depends only on properties)
CREATE POLICY "Access changeovers"
ON changeovers FOR SELECT
USING (
  share_token IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM properties
    WHERE id = changeovers.property_id
    AND (
      created_by = auth.uid()
      OR id IN (
        SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
      )
    )
  )
);

-- Findings policies (depends on changeovers)
CREATE POLICY "View findings"
ON findings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM changeovers
    WHERE id = findings.changeover_id
    AND (
      share_token IS NOT NULL
      OR property_id IN (
        SELECT id FROM properties
        WHERE created_by = auth.uid()
        OR id IN (
          SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Create findings"
ON findings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers
    WHERE id = changeover_id
    AND (
      share_token IS NOT NULL
      OR property_id IN (
        SELECT id FROM properties
        WHERE created_by = auth.uid()
        OR id IN (
          SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Update findings"
ON findings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM changeovers
    WHERE id = findings.changeover_id
    AND property_id IN (
      SELECT id FROM properties
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers
    WHERE id = findings.changeover_id
    AND property_id IN (
      SELECT id FROM properties
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
      )
    )
  )
);

-- Ensure all necessary indexes exist
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);