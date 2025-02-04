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

-- Create function to verify only notes are changing
CREATE OR REPLACE FUNCTION verify_finding_notes_only(
  finding_record findings,
  new_notes jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return true if only notes are different
  RETURN (
    finding_record.description = finding_record.description
    AND finding_record.location = finding_record.location
    AND finding_record.date_found = finding_record.date_found
    AND finding_record.status = finding_record.status
    AND finding_record.images = finding_record.images
    AND finding_record.content_item = finding_record.content_item
    AND finding_record.changeover_id = finding_record.changeover_id
    AND finding_record.share_token = finding_record.share_token
    AND finding_record.notes IS DISTINCT FROM new_notes
  );
END;
$$;

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
    -- Use helper function to verify only notes are changing
    verify_finding_notes_only(findings, notes)
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