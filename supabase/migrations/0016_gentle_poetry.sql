/*
  # Add notes support to findings

  1. Changes
    - Add notes column to findings table
    - Add created_at timestamp for each note
    - Add user_id reference to track who added the note
  
  2. Structure
    - Notes stored as JSONB array with each note containing:
      - text: The note content
      - created_at: Timestamp when note was added
      - user_id: Reference to auth.users
*/

-- Add notes column to findings table
ALTER TABLE findings
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS findings_notes_idx ON findings USING gin (notes);

-- Update RLS policies to allow note updates
CREATE POLICY "Users can update notes on findings they can access"
ON findings
FOR UPDATE
TO authenticated
USING (
  changeover_id IN (
    SELECT id FROM changeovers 
    WHERE share_token IS NOT NULL
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT id FROM changeovers 
    WHERE share_token IS NOT NULL
    OR created_by = auth.uid()
  )
);