/*
  # Fix findings policies syntax

  1. Changes
    - Drop existing finding policies
    - Create new comprehensive policies without using EXCEPT
    - Add proper handling for share token access
    - Fix note updates for anonymous users

  2. Security
    - Maintain proper access control
    - Allow anonymous users with share tokens to add notes
    - Prevent unauthorized access
*/

-- Drop existing finding policies
DROP POLICY IF EXISTS "findings_select_policy" ON findings;
DROP POLICY IF EXISTS "findings_insert_policy" ON findings;
DROP POLICY IF EXISTS "findings_update_policy" ON findings;

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
        OLD.description = NEW.description AND
        OLD.location = NEW.location AND
        OLD.date_found = NEW.date_found AND
        OLD.user_id IS NOT DISTINCT FROM NEW.user_id AND
        OLD.changeover_id = NEW.changeover_id AND
        OLD.status = NEW.status AND
        OLD.images IS NOT DISTINCT FROM NEW.images AND
        OLD.content_item IS NOT DISTINCT FROM NEW.content_item AND
        OLD.anonymous_user_id IS NOT DISTINCT FROM NEW.anonymous_user_id))
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
        OLD.description = NEW.description AND
        OLD.location = NEW.location AND
        OLD.date_found = NEW.date_found AND
        OLD.user_id IS NOT DISTINCT FROM NEW.user_id AND
        OLD.changeover_id = NEW.changeover_id AND
        OLD.status = NEW.status AND
        OLD.images IS NOT DISTINCT FROM NEW.images AND
        OLD.content_item IS NOT DISTINCT FROM NEW.content_item AND
        OLD.anonymous_user_id IS NOT DISTINCT FROM NEW.anonymous_user_id))
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