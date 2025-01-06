-- Step 1: Disable RLS on property_access table
ALTER TABLE property_access DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies on property_access table
DROP POLICY IF EXISTS "property_access_view" ON property_access;
DROP POLICY IF EXISTS "property_access_manage" ON property_access;
DROP POLICY IF EXISTS "view_access" ON property_access;
DROP POLICY IF EXISTS "manage_access" ON property_access;
DROP POLICY IF EXISTS "access_own_records" ON property_access;
DROP POLICY IF EXISTS "admin_manage_access" ON property_access;