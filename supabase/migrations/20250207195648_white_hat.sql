/*
  # Task Scheduling Improvements
  
  1. Changes
    - Modified task scheduling logic to run tasks every time by default when no rules are specified
    - Added indexes to improve task execution query performance
    - Added task execution status tracking
    - Added validation for scheduling rules
  
  2. New Features
    - Task execution status tracking (success/failure)
    - Task execution notes/comments
    - Better performance for task scheduling queries
*/

-- Add status and notes to task executions
ALTER TABLE task_executions 
ADD COLUMN status text DEFAULT 'success' CHECK (status IN ('success', 'failure')),
ADD COLUMN notes text;

-- Add indexes for better performance
CREATE INDEX idx_task_executions_task_id ON task_executions(task_id);
CREATE INDEX idx_task_executions_changeover_id ON task_executions(changeover_id);
CREATE INDEX idx_task_executions_executed_at ON task_executions(executed_at);

-- Add validation for scheduling rules
CREATE OR REPLACE FUNCTION validate_scheduling_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate changeover_interval
  IF (NEW.scheduling_rules->>'changeover_interval') IS NOT NULL THEN
    IF NOT (NEW.scheduling_rules->>'changeover_interval')::int > 0 THEN
      RAISE EXCEPTION 'Changeover interval must be greater than 0';
    END IF;
  END IF;

  -- Validate month_interval
  IF (NEW.scheduling_rules->>'month_interval') IS NOT NULL THEN
    IF NOT (NEW.scheduling_rules->>'month_interval')::int > 0 THEN
      RAISE EXCEPTION 'Month interval must be greater than 0';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for scheduling rules validation
CREATE TRIGGER validate_scheduling_rules_trigger
  BEFORE INSERT OR UPDATE ON property_tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_scheduling_rules();

-- Update should_include_task function to run tasks by default when no rules exist
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
  v_rules jsonb;
  v_last_execution task_executions;
  v_changeover_count int;
  v_months_since_last numeric;
BEGIN
  -- Get task and rules
  SELECT * INTO v_task
  FROM property_tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_rules := COALESCE(v_task.scheduling_rules, '{}'::jsonb);

  -- If no rules or empty rules, always include the task
  IF v_rules = '{}'::jsonb OR v_rules IS NULL THEN
    RETURN true;
  END IF;

  -- Get last successful execution
  SELECT * INTO v_last_execution
  FROM task_executions
  WHERE task_id = p_task_id
  AND status = 'success'
  ORDER BY executed_at DESC
  LIMIT 1;

  -- Check interval rules
  IF v_rules ? 'changeover_interval' THEN
    -- Count changeovers since last execution
    SELECT COUNT(*) INTO v_changeover_count
    FROM changeovers c
    WHERE c.property_id = v_task.property_id
    AND c.status = 'complete'
    AND (
      v_last_execution IS NULL OR
      c.completed_at > v_last_execution.executed_at
    );

    IF v_changeover_count < (v_rules->>'changeover_interval')::int THEN
      RETURN false;
    END IF;
  END IF;

  -- Check month interval rules
  IF v_rules ? 'month_interval' THEN
    IF v_last_execution IS NOT NULL THEN
      -- Calculate months since last execution
      v_months_since_last := EXTRACT(EPOCH FROM (now() - v_last_execution.executed_at)) / (30 * 24 * 60 * 60);
      
      IF v_months_since_last < (v_rules->>'month_interval')::numeric THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- Add comment explaining task execution
COMMENT ON TABLE task_executions IS 
'Tracks when tasks are executed as part of changeovers, including success/failure status and any notes.
Tasks without scheduling rules run every time by default.';