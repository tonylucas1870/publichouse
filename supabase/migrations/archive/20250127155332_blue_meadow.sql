/*
  # Update findings RLS policies

  1. Changes
    - Modify finding insert policy to properly handle shared changeovers
    - Add user_id population for shared changeover findings
    - Ensure proper access control for shared changeovers

  2. Security
    - Maintains RLS protection
    - Allows finding creation through share tokens
    - Preserves property owner access
*/

-- Drop existing finding policies
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_access" ON findings;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;

-- Create comprehensive finding policies
CREATE POLICY "finding_select" ON findings
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

CREATE POLICY "finding_insert" ON findings
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

CREATE POLICY "finding_update" ON findings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = changeover_id
    AND p.created_by = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = changeover_id
    AND p.created_by = auth.uid()
  )
);

-- Create trigger to set user_id for findings
CREATE OR REPLACE FUNCTION set_finding_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Set user_id to authenticated user
  NEW.user_id = auth.uid();
  
  -- For shared changeovers, get property owner
  IF NEW.user_id IS NULL THEN
    SELECT p.created_by INTO NEW.user_id
    FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = NEW.changeover_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to set user_id before insert
DROP TRIGGER IF EXISTS set_finding_user_id_trigger ON findings;
CREATE TRIGGER set_finding_user_id_trigger
  BEFORE INSERT ON findings
  FOR EACH ROW
  EXECUTE FUNCTION set_finding_user_id();