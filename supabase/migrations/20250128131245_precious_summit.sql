/*
  # Fix findings update policy syntax

  1. Changes
    - Drop existing finding policies
    - Create new comprehensive policies with proper OLD record handling
    - Fix note updates for anonymous users
    - Maintain same security model with valid syntax

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
  -- Get changeover details
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      -- Allow updates through share token for notes only
      (c.share_token IS NOT NULL AND
       -- For share token access, only allow note updates
       EXISTS (
         SELECT 1 FROM findings f
         WHERE f.id = findings.id
         -- Verify only notes are being changed
         AND f.description = findings.description
         AND f.location = findings.location
         AND f.date_found = findings.date_found
         AND (f.user_id IS NULL AND findings.user_id IS NULL OR f.user_id = findings.user_id)
         AND f.changeover_id = findings.changeover_id
         AND f.status = findings.status
         AND f.images = findings.images
         AND (f.content_item IS NULL AND findings.content_item IS NULL OR f.content_item = findings.content_item)
         AND (f.anonymous_user_id IS NULL AND findings.anonymous_user_id IS NULL OR f.anonymous_user_id = findings.anonymous_user_id)
         -- Ensure notes are actually changing
         AND f.notes IS DISTINCT FROM findings.notes
       ))
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
  -- Get changeover details
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      -- Allow updates through share token for notes only
      (c.share_token IS NOT NULL AND
       -- For share token access, only allow note updates
       EXISTS (
         SELECT 1 FROM findings f
         WHERE f.id = findings.id
         -- Verify only notes are being changed
         AND f.description = findings.description
         AND f.location = findings.location
         AND f.date_found = findings.date_found
         AND (f.user_id IS NULL AND findings.user_id IS NULL OR f.user_id = findings.user_id)
         AND f.changeover_id = findings.changeover_id
         AND f.status = findings.status
         AND f.images = findings.images
         AND (f.content_item IS NULL AND findings.content_item IS NULL OR f.content_item = findings.content_item)
         AND (f.anonymous_user_id IS NULL AND findings.anonymous_user_id IS NULL OR f.anonymous_user_id = findings.anonymous_user_id)
         -- Ensure notes are actually changing
         AND f.notes IS DISTINCT FROM findings.notes
       ))
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