-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_changeover_status;

-- Create function to update changeover status
CREATE OR REPLACE FUNCTION update_changeover_status(
  changeover_id_input uuid,
  new_status text
)
RETURNS changeovers
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  result changeovers;
BEGIN
  -- Check if user has permission
  IF NOT EXISTS (
    SELECT 1 FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = changeover_id_input
    AND p.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update changeover status';
  END IF;

  -- Validate status
  IF new_status NOT IN ('scheduled', 'in_progress', 'complete') THEN
    RAISE EXCEPTION 'Invalid status. Must be scheduled, in_progress, or complete';
  END IF;

  -- Update status
  UPDATE changeovers
  SET status = new_status::changeover_status
  WHERE id = changeover_id_input
  RETURNING * INTO result;

  RETURN result;
END;
$$;