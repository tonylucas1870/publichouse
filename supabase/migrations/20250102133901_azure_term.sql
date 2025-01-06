/*
  # Final RLS Policy Fix
  
  1. Changes
    - Remove all circular dependencies
    - Simplify policy structure
    - Use EXISTS for better performance
    
  2. Security
    - Maintain proper access control
    - Support property owners and cleaners
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Access properties" ON properties;
DROP POLICY IF EXISTS "Access changeovers" ON changeovers;
DROP POLICY IF EXISTS "View findings" ON findings;
DROP POLICY IF EXISTS "Create findings" ON findings;
DROP POLICY IF EXISTS "Update findings" ON findings;

-- Properties: Base level access (no dependencies)
CREATE POLICY "properties_access"
ON properties FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM property_cleaners 
    WHERE property_id = properties.id 
    AND user_id = auth.uid()
  )
);

-- Changeovers: Depends only on properties
CREATE POLICY "changeovers_access"
ON changeovers FOR SELECT
USING (
  share_token IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM properties
    WHERE id = changeovers.property_id
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM property_cleaners
        WHERE property_id = properties.id
        AND user_id = auth.uid()
      )
    )
  )
);

-- Findings: Depends only on changeovers
CREATE POLICY "findings_select"
ON findings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM changeovers
    WHERE id = findings.changeover_id
    AND (
      share_token IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM properties
        WHERE id = changeovers.property_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM property_cleaners
            WHERE property_id = properties.id
            AND user_id = auth.uid()
          )
        )
      )
    )
  )
);

CREATE POLICY "findings_insert"
ON findings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers
    WHERE id = changeover_id
    AND (
      share_token IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM properties
        WHERE id = changeovers.property_id
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM property_cleaners
            WHERE property_id = properties.id
            AND user_id = auth.uid()
          )
        )
      )
    )
  )
);

CREATE POLICY "findings_update"
ON findings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM changeovers
    WHERE id = findings.changeover_id
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE id = changeovers.property_id
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM property_cleaners
          WHERE property_id = properties.id
          AND user_id = auth.uid()
        )
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers
    WHERE id = findings.changeover_id
    AND EXISTS (
      SELECT 1 FROM properties
      WHERE id = changeovers.property_id
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM property_cleaners
          WHERE property_id = properties.id
          AND user_id = auth.uid()
        )
      )
    )
  )
);

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);