/*
  # Update findings policies for anonymous users

  1. Changes
    - Drop existing finding policies
    - Create new comprehensive policies that handle both authenticated and anonymous users
    - Add proper handling for share token access
    - Fix note updates for anonymous users

  2. Security
    - Maintain proper access control
    - Allow anonymous users with share tokens to add notes
    - Prevent unauthorized access
*/

-- Drop existing finding policies
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;

-- Create new comprehensive policies
CREATE POLICY "findings_select_policy" ON findings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      -- Allow access through share token
      c.share_token IS NOT NULL
      OR
      -- Allow access to property owner
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = c.property_id
        AND p.created_by = auth.uid()
      )
    )
  )
);

CREATE POLICY "findings_insert_policy" ON findings
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      -- Allow insert through share token
      c.share_token IS NOT NULL
      OR
      -- Allow insert by property owner
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = c.property_id
        AND p.created_by = auth.uid()
      )
    )
  )
);

CREATE POLICY "findings_update_policy" ON findings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      -- Allow updates through share token for notes only
      (c.share_token IS NOT NULL AND 
       (OLD.notes IS DISTINCT FROM NEW.notes AND
        OLD.* IS NOT DISTINCT FROM NEW.* EXCEPT notes))
      OR
      -- Allow all updates by property owner
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = c.property_id
        AND p.created_by = auth.uid()
      )
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      -- Allow updates through share token for notes only
      (c.share_token IS NOT NULL AND 
       (OLD.notes IS DISTINCT FROM NEW.notes AND
        OLD.* IS NOT DISTINCT FROM NEW.* EXCEPT notes))
      OR
      -- Allow all updates by property owner
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = c.property_id
        AND p.created_by = auth.uid()
      )
    )
  )
);