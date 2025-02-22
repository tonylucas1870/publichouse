/*
  # Add task scheduling capabilities
  
  1. Changes
    - Add scheduling rules to property tasks
    - Add task execution history tracking
    - Add function to determine if task should be included
    
  2. New Tables
    - task_executions: Tracks when tasks were executed
    
  3. Modified Tables
    - property_tasks: Add scheduling rules
*/

-- Add scheduling rules to property tasks
ALTER TABLE property_tasks
ADD COLUMN scheduling_rules jsonb DEFAULT '{}'::jsonb,
ADD COLUMN last_executed timestamptz;

-- Create task executions table
CREATE TABLE task_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES property_tasks(id) ON DELETE CASCADE,
  changeover_id uuid REFERENCES changeovers(id) ON DELETE CASCADE,
  executed_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(task_id, changeover_id)
);

-- Enable RLS
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view task executions for their properties"
ON task_executions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM property_tasks pt
    JOIN properties p ON p.id = pt.property_id
    WHERE pt.id = task_executions.task_id
    AND p.created_by = auth.uid()
  )
);

-- Function to check if task should be included based on rules
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

  -- If no rules, always include
  IF v_rules = '{}'::jsonb THEN
    RETURN true;
  END IF;

  -- Get last execution
  SELECT * INTO v_last_execution
  FROM task_executions
  WHERE task_id = p_task_id
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

-- Update finding creation to use scheduling rules
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
      content_item
    )
    SELECT
      pt.title,
      pt.location,
      NEW.id,
      'pending',
      NEW.created_by,
      NULL
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