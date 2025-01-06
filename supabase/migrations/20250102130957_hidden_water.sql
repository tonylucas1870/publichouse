/*
  # Fix shared changeover access

  1. Changes
    - Drop existing findings policies
    - Create new policies that properly handle both property owner and shared access
    - Add policy for shared changeover note updates
    - Add policy for shared changeover status updates
    
  2. Security
    - Maintain strict access control for property owners
    - Allow full access for shared changeover viewers
    - Prevent access to findings outside of owned/shared changeovers
*/

-- Drop existing findings policies
DROP POLICY IF EXISTS "Property owners can view findings" ON findings;
DROP POLICY IF EXISTS "Shared changeover viewers can view findings" ON findings;
DROP POLICY IF EXISTS "Property owners can create findings" ON findings;
DROP POLICY IF EXISTS "Shared changeover viewers can create findings" ON findings;
DROP POLICY IF EXISTS "Property owners can update findings" ON findings;
DROP POLICY IF EXISTS "Property owners can view pending findings" ON findings;

-- Create comprehensive access policies
CREATE POLICY "Changeover access view findings"
ON findings FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM changeovers c
    LEFT JOIN properties p ON c.property_id = p.id
    WHERE c.id = findings.changeover_id
    AND (
      c.share_token IS NOT NULL -- Shared access
      OR p.created_by = auth.uid() -- Property owner access
    )
  )
);

CREATE POLICY "Changeover access create findings"
ON findings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM changeovers c
    LEFT JOIN properties p ON c.property_id = p.id
    WHERE c.id = changeover_id
    AND (
      c.share_token IS NOT NULL -- Shared access
      OR p.created_by = auth.uid() -- Property owner access
    )
  )
);

CREATE POLICY "Changeover access update findings"
ON findings FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM changeovers c
    LEFT JOIN properties p ON c.property_id = p.id
    WHERE c.id = findings.changeover_id
    AND (
      c.share_token IS NOT NULL -- Shared access
      OR p.created_by = auth.uid() -- Property owner access
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM changeovers c
    LEFT JOIN properties p ON c.property_id = p.id
    WHERE c.id = findings.changeover_id
    AND (
      c.share_token IS NOT NULL -- Shared access
      OR p.created_by = auth.uid() -- Property owner access
    )
  )
);

-- Add policy for pending findings view (property owners only)
CREATE POLICY "Property owners view pending findings"
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
    AND c.share_token IS NULL -- Exclude shared changeovers
  )
);

-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS findings_status_changeover_idx ON findings(status, changeover_id);
CREATE INDEX IF NOT EXISTS changeovers_share_token_idx ON changeovers(share_token) WHERE share_token IS NOT NULL;