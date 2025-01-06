/*
  # Refine findings access policies

  Updates the RLS policies to:
  - Simplify policy structure
  - Ensure proper shared access
  - Maintain security boundaries
  - Improve query performance
*/

-- Drop existing findings policies
DROP POLICY IF EXISTS "Changeover access view findings" ON findings;
DROP POLICY IF EXISTS "Changeover access create findings" ON findings;
DROP POLICY IF EXISTS "Changeover access update findings" ON findings;
DROP POLICY IF EXISTS "Property owners view pending findings" ON findings;

-- Create simplified access policies
CREATE POLICY "View findings with changeover access"
ON findings FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM changeovers c
    WHERE c.id = findings.changeover_id
    AND (
      c.share_token IS NOT NULL  -- Allow shared access
      OR EXISTS (                -- Or property owner access
        SELECT 1 
        FROM properties p 
        WHERE p.id = c.property_id 
        AND p.created_by = auth.uid()
      )
    )
  )
);

CREATE POLICY "Create findings with changeover access"
ON findings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      c.share_token IS NOT NULL  -- Allow shared access
      OR EXISTS (                -- Or property owner access
        SELECT 1 
        FROM properties p 
        WHERE p.id = c.property_id 
        AND p.created_by = auth.uid()
      )
    )
  )
);

CREATE POLICY "Update findings with changeover access"
ON findings FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM changeovers c
    WHERE c.id = findings.changeover_id
    AND (
      c.share_token IS NOT NULL  -- Allow shared access
      OR EXISTS (                -- Or property owner access
        SELECT 1 
        FROM properties p 
        WHERE p.id = c.property_id 
        AND p.created_by = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM changeovers c
    WHERE c.id = findings.changeover_id
    AND (
      c.share_token IS NOT NULL  -- Allow shared access
      OR EXISTS (                -- Or property owner access
        SELECT 1 
        FROM properties p 
        WHERE p.id = c.property_id 
        AND p.created_by = auth.uid()
      )
    )
  )
);

-- Add policy for pending findings (property owners only)
CREATE POLICY "View pending findings for property owners"
ON findings FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM changeovers c
    JOIN properties p ON c.property_id = p.id
    WHERE c.id = findings.changeover_id
    AND p.created_by = auth.uid()
  )
);

-- Ensure proper indexes exist
DROP INDEX IF EXISTS findings_status_changeover_idx;
CREATE INDEX findings_status_changeover_idx ON findings(status, changeover_id);

DROP INDEX IF EXISTS changeovers_share_token_idx;
CREATE INDEX changeovers_share_token_idx ON changeovers(share_token) WHERE share_token IS NOT NULL;