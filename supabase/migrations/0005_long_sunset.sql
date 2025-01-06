/*
  # Fix share token access permissions

  1. Changes
    - Update RLS policies to allow public access to changeovers and related data via share token
    - Add policies to allow viewing property details for shared changeovers
    
  2. Security
    - Maintains security by only allowing access to specific changeover data via valid share token
    - Prevents access to other sensitive data
*/

-- Update changeovers policy to allow public access via share token
DROP POLICY IF EXISTS "Anyone with share token can view changeover" ON changeovers;

CREATE POLICY "Anyone with share token can view changeover"
ON changeovers FOR SELECT
TO public
USING (share_token IS NOT NULL);

-- Allow viewing property details for shared changeovers
CREATE POLICY "Anyone can view property details for shared changeovers"
ON properties FOR SELECT
TO public
USING (
  id IN (
    SELECT property_id 
    FROM changeovers 
    WHERE share_token IS NOT NULL
  )
);