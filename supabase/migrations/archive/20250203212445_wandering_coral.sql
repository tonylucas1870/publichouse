/*
  # Update Finding Statuses

  1. Changes
    - Update finding status enum to include new statuses
    - Convert existing 'pending' findings to 'open'
    - Update constraints and defaults
  
  2. Status Meanings
    - Open: Finding needs attention/review
    - Blocked: Cannot be fixed due to external factors
    - Won't Fix: Deliberately decided not to fix
    - Fixed: Issue has been resolved
    - Pending: Initial state before review (new findings)
*/

-- Drop existing status constraint
ALTER TABLE findings 
DROP CONSTRAINT IF EXISTS findings_status_check;

-- Add new status constraint
ALTER TABLE findings
ADD CONSTRAINT findings_status_check 
CHECK (status IN ('pending', 'open', 'blocked', 'wont_fix', 'fixed'));

-- Update existing pending findings to open
UPDATE findings 
SET status = 'open' 
WHERE status = 'pending';

-- Set default status to pending
ALTER TABLE findings 
ALTER COLUMN status SET DEFAULT 'pending';

-- Add comment explaining statuses
COMMENT ON COLUMN findings.status IS 
'Finding status:
 - pending: Initial state before review
 - open: Needs attention/review
 - blocked: Cannot be fixed due to external factors
 - wont_fix: Deliberately decided not to fix
 - fixed: Issue has been resolved';