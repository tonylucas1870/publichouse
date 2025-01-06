/*
  # Fix pending findings access control
  
  1. Changes
    - Drop and recreate pending findings policy with proper joins
    - Add composite index for better performance
    
  2. Security
    - Ensures pending findings are only visible to property owners
    - Prevents access via share token
*/

-- Drop existing pending findings policy
DROP POLICY IF EXISTS "Property owners can view pending findings" ON findings;

-- Create new policy with proper joins
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
    AND c.share_token IS NULL -- Explicitly prevent share token access
  )
);

-- Add composite index for better query performance
CREATE INDEX IF NOT EXISTS findings_status_changeover_idx 
ON findings(status, changeover_id);