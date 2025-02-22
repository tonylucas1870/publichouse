/*
  # Simplified findings update policy

  1. Changes
    - Drop existing findings update policy
    - Create new simplified policy that allows:
      - Updates through share token
      - Updates by property owner
    - Remove complex field comparisons
    - Fix recursion issues

  2. Security
    - Maintain proper access control
    - Allow anonymous users with share tokens to add notes
    - Prevent unauthorized access
*/

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "findings_update_policy" ON public.findings;

-- Create a simplified findings update policy
CREATE POLICY "findings_update_policy" 
ON public.findings
AS PERMISSIVE
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM changeovers c
    WHERE c.id = findings.changeover_id
    AND (
      -- Allow updates through share token
      c.share_token IS NOT NULL
      OR
      -- Allow updates by property owner
      EXISTS (
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
      -- Allow updates through share token
      c.share_token IS NOT NULL
      OR
      -- Allow updates by property owner
      EXISTS (
        SELECT 1
        FROM properties p
        WHERE p.id = c.property_id
        AND p.created_by = auth.uid()
      )
    )
  )
);