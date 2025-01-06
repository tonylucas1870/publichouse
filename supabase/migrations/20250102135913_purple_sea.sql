/*
  # Fix Database Policies
  
  1. Changes
    - Create materialized views for access control
    - Simplify policies using views
    - Add proper indexes
    
  2. Security
    - Maintain strict access control
    - Prevent infinite recursion
    - Ensure proper authorization
*/

-- Step 1: Drop existing policies and views
DROP POLICY IF EXISTS "view_properties" ON properties;
DROP POLICY IF EXISTS "view_changeovers" ON changeovers;
DROP POLICY IF EXISTS "view_findings" ON findings;
DROP POLICY IF EXISTS "insert_findings" ON findings;
DROP POLICY IF EXISTS "update_findings" ON findings;

DROP VIEW IF EXISTS accessible_findings;
DROP VIEW IF EXISTS accessible_changeovers;
DROP VIEW IF EXISTS accessible_properties;

-- Step 2: Create materialized views for access control
CREATE MATERIALIZED VIEW user_accessible_properties AS
SELECT DISTINCT p.id
FROM properties p
LEFT JOIN property_cleaners pc ON pc.property_id = p.id
WHERE p.created_by = auth.uid() 
   OR pc.user_id = auth.uid();

CREATE MATERIALIZED VIEW user_accessible_changeovers AS
SELECT DISTINCT c.id
FROM changeovers c
WHERE c.share_token IS NOT NULL
   OR c.property_id IN (SELECT id FROM user_accessible_properties);

CREATE MATERIALIZED VIEW user_accessible_findings AS
SELECT DISTINCT f.id
FROM findings f
WHERE f.changeover_id IN (SELECT id FROM user_accessible_changeovers);

-- Step 3: Create simple policies using materialized views
CREATE POLICY "select_properties"
ON properties FOR SELECT
TO authenticated
USING (id IN (SELECT id FROM user_accessible_properties));

CREATE POLICY "select_changeovers"
ON changeovers FOR SELECT
USING (id IN (SELECT id FROM user_accessible_changeovers));

CREATE POLICY "select_findings"
ON findings FOR SELECT
USING (id IN (SELECT id FROM user_accessible_findings));

CREATE POLICY "insert_findings"
ON findings FOR INSERT
WITH CHECK (
  changeover_id IN (SELECT id FROM user_accessible_changeovers)
);

CREATE POLICY "update_findings"
ON findings FOR UPDATE
USING (
  id IN (SELECT id FROM user_accessible_findings)
  AND changeover_id IN (
    SELECT c.id 
    FROM changeovers c
    WHERE c.id IN (SELECT id FROM user_accessible_changeovers)
    AND c.share_token IS NULL
  )
)
WITH CHECK (
  changeover_id IN (
    SELECT c.id 
    FROM changeovers c
    WHERE c.id IN (SELECT id FROM user_accessible_changeovers)
    AND c.share_token IS NULL
  )
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_user_id ON property_cleaners(user_id);
CREATE INDEX IF NOT EXISTS idx_property_cleaners_property_id ON property_cleaners(property_id);

-- Step 5: Create refresh function and trigger
CREATE OR REPLACE FUNCTION refresh_access_views()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_accessible_properties;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_accessible_changeovers;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_accessible_findings;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_access_views_trigger
AFTER INSERT OR UPDATE OR DELETE
ON properties
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_access_views();

CREATE TRIGGER refresh_access_views_trigger
AFTER INSERT OR UPDATE OR DELETE
ON property_cleaners
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_access_views();

CREATE TRIGGER refresh_access_views_trigger
AFTER INSERT OR UPDATE OR DELETE
ON changeovers
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_access_views();