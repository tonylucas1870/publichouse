-- Step 1: Disable RLS on properties and property_access tables
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_access DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on properties table
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "property_update_policy" ON properties;
DROP POLICY IF EXISTS "property_select_policy" ON properties;
DROP POLICY IF EXISTS "property_base_access" ON properties;
DROP POLICY IF EXISTS "access_property" ON properties;
DROP POLICY IF EXISTS "access_properties" ON properties;
DROP POLICY IF EXISTS "base_property_access" ON properties;
DROP POLICY IF EXISTS "mv_property_access" ON properties;
DROP POLICY IF EXISTS "owner_access" ON properties;

-- Step 3: Drop ALL existing policies on property_access table
DROP POLICY IF EXISTS "property_access_view" ON property_access;
DROP POLICY IF EXISTS "property_access_manage" ON property_access;
DROP POLICY IF EXISTS "view_access" ON property_access;
DROP POLICY IF EXISTS "manage_access" ON property_access;
DROP POLICY IF EXISTS "access_own_records" ON property_access;
DROP POLICY IF EXISTS "admin_manage_access" ON property_access;
DROP POLICY IF EXISTS "property_owners_manage_access" ON property_access;
DROP POLICY IF EXISTS "manage_property_access" ON property_access;