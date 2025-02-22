-- Add function to generate share tokens for findings
CREATE OR REPLACE FUNCTION generate_finding_share_token() 
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only generate token if one doesn't exist
  IF NEW.share_token IS NULL THEN
    NEW.share_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to automatically generate share tokens
CREATE TRIGGER generate_finding_share_token_trigger
  BEFORE INSERT ON findings
  FOR EACH ROW
  EXECUTE FUNCTION generate_finding_share_token();

-- Add function to create share links
CREATE OR REPLACE FUNCTION create_finding_share_link(finding_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_share_token text;
BEGIN
  -- Get or create share token
  UPDATE findings
  SET share_token = COALESCE(share_token, encode(gen_random_bytes(32), 'hex'))
  WHERE id = finding_id
  RETURNING share_token INTO v_share_token;

  RETURN v_share_token;
END;
$$;

-- Update finding policies to allow viewing via share token
DROP POLICY IF EXISTS "findings_select_policy" ON findings;
CREATE POLICY "findings_select_policy" ON findings
FOR SELECT USING (
  share_token IS NOT NULL
  OR
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