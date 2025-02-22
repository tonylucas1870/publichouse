-- Drop existing policies
DROP POLICY IF EXISTS "findings_select_policy" ON findings;
DROP POLICY IF EXISTS "findings_update_notes_policy" ON findings;

-- Create comprehensive policies for findings
CREATE POLICY "findings_select_policy" ON findings
FOR SELECT USING (
  -- Allow access via direct finding share token
  share_token IS NOT NULL
  OR
  -- Allow access via changeover
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND (
      -- Allow access through changeover share token
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

-- Allow notes only for findings accessed through changeover share tokens
CREATE POLICY "findings_update_notes_policy" ON findings
FOR UPDATE USING (
  -- Allow updates via changeover share token
  EXISTS (
    SELECT 1 FROM changeovers c
    WHERE c.id = changeover_id
    AND c.share_token IS NOT NULL
  )
  OR
  -- Allow updates by property owner
  EXISTS (
    SELECT 1 FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = changeover_id
    AND p.created_by = auth.uid()
  )
) WITH CHECK (
  -- For share token access, only allow note updates
  (
    EXISTS (
      SELECT 1 FROM changeovers c
      WHERE c.id = changeover_id
      AND c.share_token IS NOT NULL
    )
    AND
    -- Only allow notes to be modified
    OLD.description = NEW.description
    AND OLD.location = NEW.location
    AND OLD.date_found = NEW.date_found
    AND OLD.status = NEW.status
    AND OLD.images = NEW.images
    AND OLD.content_item = NEW.content_item
    AND OLD.changeover_id = NEW.changeover_id
    AND OLD.share_token = NEW.share_token
  )
  OR
  -- Allow all updates by property owner
  EXISTS (
    SELECT 1 FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = changeover_id
    AND p.created_by = auth.uid()
  )
);

-- Add comment explaining policies
COMMENT ON TABLE findings IS 
'Findings can be accessed anonymously via share tokens (either direct finding share token
or through a changeover share token). However, notes can only be added when accessing
through a changeover share token. Property owners have full access to their findings.';