/*
  # Add Property Tasks

  1. New Tables
    - `property_tasks` - Standard tasks/findings for properties
      - `id` (uuid, primary key)
      - `property_id` (uuid, references properties)
      - `title` (text)
      - `description` (text)
      - `location` (text)
      - `created_at` (timestamptz)
      - `created_by` (uuid)

  2. Security
    - Enable RLS on `property_tasks` table
    - Add policies for property owners
*/

-- Create property tasks table
CREATE TABLE property_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(property_id, title)
);

-- Enable RLS
ALTER TABLE property_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage tasks for their properties"
ON property_tasks
FOR ALL
USING (
  property_id IN (
    SELECT id FROM properties
    WHERE created_by = auth.uid()
  )
)
WITH CHECK (
  property_id IN (
    SELECT id FROM properties
    WHERE created_by = auth.uid()
  )
);

-- Function to automatically create findings from tasks
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
      'open',
      NEW.created_by,
      NULL
    FROM property_tasks pt
    WHERE pt.property_id = NEW.property_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER create_findings_from_tasks_trigger
  AFTER UPDATE OF status ON changeovers
  FOR EACH ROW
  EXECUTE FUNCTION create_findings_from_tasks();