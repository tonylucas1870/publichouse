/*
  # Add image support to standard tasks

  1. Changes
    - Add images column to property_tasks table
    - Add function to copy task images to findings

  2. Details
    - Images stored as JSONB array like findings
    - Images copied to findings when tasks create them
    - Full validation of image data
*/

-- Add images column to property tasks
ALTER TABLE property_tasks
ADD COLUMN images jsonb DEFAULT '[]'::jsonb,
ADD CONSTRAINT task_images_is_array CHECK (jsonb_typeof(images) = 'array');

-- Update create_findings_from_tasks to copy images
CREATE OR REPLACE FUNCTION create_findings_from_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only proceed if status is changing to in_progress
  IF NEW.status = 'in_progress' AND OLD.status = 'scheduled' THEN
    -- Create findings for each applicable task
    INSERT INTO findings (
      description,
      location,
      changeover_id,
      status,
      user_id,
      content_item,
      images
    )
    SELECT
      pt.title,
      pt.location,
      NEW.id,
      'pending',
      NEW.created_by,
      NULL,
      pt.images  -- Copy images from task to finding
    FROM property_tasks pt
    WHERE pt.property_id = NEW.property_id
    AND should_include_task(pt.id, NEW.id);

    -- Record task executions
    INSERT INTO task_executions (
      task_id,
      changeover_id,
      created_by
    )
    SELECT
      pt.id,
      NEW.id,
      NEW.created_by
    FROM property_tasks pt
    WHERE pt.property_id = NEW.property_id
    AND should_include_task(pt.id, NEW.id);

    -- Update last_executed timestamp
    UPDATE property_tasks pt
    SET last_executed = now()
    WHERE pt.property_id = NEW.property_id
    AND should_include_task(pt.id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;