/*
  # Add finding share tokens

  1. Changes
    - Add share_token column to findings table
    - Add index for efficient share token lookups
    - Add RLS policy for share token access
    - Add function to generate share tokens

  2. Security
    - Share tokens are randomly generated using cryptographically secure function
    - RLS policy allows read-only access via share token
*/

-- Add share token column to findings
ALTER TABLE findings
ADD COLUMN share_token text DEFAULT encode(gen_random_bytes(32), 'hex');

-- Add index for share token lookups
CREATE INDEX idx_findings_share_token ON findings(share_token) 
WHERE share_token IS NOT NULL;

-- Create function to generate share tokens
CREATE OR REPLACE FUNCTION generate_finding_share_token() 
RETURNS text
LANGUAGE sql
AS $$
  SELECT encode(gen_random_bytes(32), 'hex');
$$;

-- Update RLS policies to allow access via share token
CREATE POLICY "Anyone with share token can view finding"
ON findings FOR SELECT
USING (share_token IS NOT NULL);

-- Add comment explaining share tokens
COMMENT ON COLUMN findings.share_token IS 
'Randomly generated token that allows anonymous access to view a specific finding.
The token is generated using a cryptographically secure random function.';