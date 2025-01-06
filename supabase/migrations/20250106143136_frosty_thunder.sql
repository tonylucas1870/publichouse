-- Create changeover status type
CREATE TYPE changeover_status AS ENUM ('scheduled', 'in_progress', 'complete');

-- Add status column to changeovers table with default value
ALTER TABLE changeovers 
ADD COLUMN status changeover_status NOT NULL DEFAULT 'scheduled';

-- Update existing changeovers to in_progress if they have findings
UPDATE changeovers c
SET status = 'in_progress'
WHERE EXISTS (
  SELECT 1 FROM findings f
  WHERE f.changeover_id = c.id
);

-- Create function to update changeover status
CREATE OR REPLACE FUNCTION update_changeover_status(
  changeover_id_input uuid,
  new_status changeover_status
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

  -- Update status
  UPDATE changeovers
  SET status = new_status
  WHERE id = changeover_id_input
  RETURNING * INTO result;

  RETURN result;
END;
$$;