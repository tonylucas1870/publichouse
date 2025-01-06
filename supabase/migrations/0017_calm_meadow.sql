/*
  # Update findings status field

  1. Changes
    - Update status values to new options (pending, fixed, wont_fix)
    - Migrate existing data to new status values
    - Add policy for status updates

  2. Security
    - Enable RLS for status updates
    - Only allow status updates for authorized users
*/

-- Drop existing status column default
ALTER TABLE findings 
ALTER COLUMN status DROP DEFAULT;

-- Create temporary column for the transition
ALTER TABLE findings 
ADD COLUMN temp_status text;

-- Copy existing status values to temporary column
UPDATE findings 
SET temp_status = status::text;

-- Drop the existing status column
ALTER TABLE findings 
DROP COLUMN status;

-- Create new status column with correct type
ALTER TABLE findings 
ADD COLUMN status text 
CHECK (status IN ('pending', 'fixed', 'wont_fix'));

-- Migrate data from temporary column
UPDATE findings 
SET status = CASE 
  WHEN temp_status = 'claimed' THEN 'fixed'
  WHEN temp_status = 'disposed' THEN 'wont_fix'
  ELSE 'pending'
END;

-- Drop temporary column
ALTER TABLE findings 
DROP COLUMN temp_status;

-- Set new default
ALTER TABLE findings 
ALTER COLUMN status SET DEFAULT 'pending';

-- Add policy for status updates
CREATE POLICY "Users can update finding status"
ON findings
FOR UPDATE
TO authenticated
USING (
  changeover_id IN (
    SELECT id FROM changeovers 
    WHERE created_by = auth.uid()
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT id FROM changeovers 
    WHERE created_by = auth.uid()
  )
);