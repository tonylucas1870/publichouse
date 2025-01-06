/*
  # Fix RLS policies to prevent infinite recursion
  
  1. Changes
    - Simplify property access policies
    - Update changeover policies
    - Update findings policies
    - Add proper indexes
    
  2. Security
    - Maintain proper access control
    - Prevent circular dependencies in policies
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "View findings with changeover access" ON findings;
DROP POLICY IF EXISTS "Create findings with changeover access" ON findings;
DROP POLICY IF EXISTS "Update findings with changeover access" ON findings;
DROP POLICY IF EXISTS "View pending findings for property owners" ON findings;
DROP POLICY IF EXISTS "Cleaners can view findings" ON findings;
DROP POLICY IF EXISTS "Cleaners can create findings" ON findings;
DROP POLICY IF EXISTS "Cleaners can view assigned changeovers" ON changeovers;

-- Properties policies
DROP POLICY IF EXISTS "Users can view their properties" ON properties;
CREATE POLICY "Users can view their properties"
ON properties FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR id IN (
    SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
  )
);

-- Changeovers policies
DROP POLICY IF EXISTS "Users can view changeovers they created" ON changeovers;
CREATE POLICY "Users can view changeovers"
ON changeovers FOR SELECT
USING (
  share_token IS NOT NULL
  OR property_id IN (
    SELECT id FROM properties WHERE created_by = auth.uid()
  )
  OR property_id IN (
    SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
  )
);

-- Findings policies
CREATE POLICY "Access findings"
ON findings FOR ALL
USING (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
    share_token IS NOT NULL
    OR property_id IN (
      SELECT id FROM properties WHERE created_by = auth.uid()
    )
    OR property_id IN (
      SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT id FROM changeovers WHERE
    share_token IS NOT NULL
    OR property_id IN (
      SELECT id FROM properties WHERE created_by = auth.uid()
    )
    OR property_id IN (
      SELECT property_id FROM property_cleaners WHERE user_id = auth.uid()
    )
  )
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);