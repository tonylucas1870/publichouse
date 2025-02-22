/*
  # Update findings status for tasks

  1. Changes
    - Modify create_findings_from_tasks function to set findings status to 'pending' instead of 'open'
    
  2. Reason
    - Findings created from tasks should start in pending state for consistency
    - Allows proper review workflow from pending -> open -> fixed
*/

-- Drop and recreate function with updated status
CREATE OR REPLACE FUNCTION create_findings_from_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only proceed if status is changing to in_progress
  IF NEW.status = 'in_progress' AND OLD.status = 'scheduled' THEN
    -- Create findings for each task
    INSERT INTO findings (
      description,
      location,
      changeover_id,
      status,
      user_id,
      content_item
    )
    SELECT
      pt.title,
      pt.location,
      NEW.id,
      'pending',  -- Set to pending instead of open
      NEW.created_by,
      NULL
    FROM property_tasks pt
    WHERE pt.property_id = NEW.property_id;
  END IF;
  
  RETURN NEW;
END;
$$;