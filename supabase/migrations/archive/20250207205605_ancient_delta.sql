/*
  # Task Scheduling UI Improvements
  
  1. Changes
    - Add validation to ensure only one scheduling type can be used at a time
    - Add scheduling_type column to make the rule type explicit
    - Add interval column for the numeric value
    - Migrate existing data to new format
  
  2. New Features
    - Explicit scheduling type selection
    - Single interval value
    - Better validation
*/

-- Add new columns for improved scheduling
ALTER TABLE property_tasks
ADD COLUMN scheduling_type text CHECK (scheduling_type IN ('changeover', 'month')),
ADD COLUMN interval int CHECK (interval > 0);

-- Migrate existing data
DO $$
BEGIN
  -- Update tasks with changeover intervals
  UPDATE property_tasks
  SET 
    scheduling_type = 'changeover',
    interval = (scheduling_rules->>'changeover_interval')::int
  WHERE scheduling_rules ? 'changeover_interval';

  -- Update tasks with month intervals
  UPDATE property_tasks
  SET 
    scheduling_type = 'month',
    interval = (scheduling_rules->>'month_interval')::int
  WHERE scheduling_rules ? 'month_interval';
END $$;

-- Update should_include_task function to use new columns
CREATE OR REPLACE FUNCTION should_include_task(
  p_task_id uuid,
  p_changeover_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task property_tasks;
  v_last_execution task_executions;
  v_changeover_count int;
  v_months_since_last numeric;
BEGIN
  -- Get task
  SELECT * INTO v_task
  FROM property_tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If no scheduling type, always include the task
  IF v_task.scheduling_type IS NULL THEN
    RETURN true;
  END IF;

  -- Get last successful execution
  SELECT * INTO v_last_execution
  FROM task_executions
  WHERE task_id = p_task_id
  AND status = 'success'
  ORDER BY executed_at DESC
  LIMIT 1;

  -- Check based on scheduling type
  CASE v_task.scheduling_type
    WHEN 'changeover' THEN
      -- Count changeovers since last execution
      SELECT COUNT(*) INTO v_changeover_count
      FROM changeovers c
      WHERE c.property_id = v_task.property_id
      AND c.status = 'complete'
      AND (
        v_last_execution IS NULL OR
        c.completed_at > v_last_execution.executed_at
      );

      IF v_changeover_count < v_task.interval THEN
        RETURN false;
      END IF;

    WHEN 'month' THEN
      IF v_last_execution IS NOT NULL THEN
        -- Calculate months since last execution
        v_months_since_last := EXTRACT(EPOCH FROM (now() - v_last_execution.executed_at)) / (30 * 24 * 60 * 60);
        
        IF v_months_since_last < v_task.interval::numeric THEN
          RETURN false;
        END IF;
      END IF;
  END CASE;

  RETURN true;
END;
$$;