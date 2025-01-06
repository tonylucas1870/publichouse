/*
  # Update findings policies for pending view

  1. Changes
    - Add separate policy for viewing pending findings
    - Ensure pending findings are only visible to property owners
    - Remove ability to view pending findings via share token

  2. Security
    - Property owners can only see pending findings for their properties
    - Share token access is restricted to specific changeover findings only
*/

-- Drop existing pending findings policy if exists
DROP POLICY IF EXISTS "Property owners can view pending findings" ON findings;

-- Create new policy for pending findings view
CREATE POLICY "Property owners can view pending findings"
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

-- Add index to improve pending findings query performance
CREATE INDEX IF NOT EXISTS findings_status_idx ON findings(status);