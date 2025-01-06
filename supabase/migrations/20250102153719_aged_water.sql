-- Step 1: Disable RLS on properties table
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on properties table
DROP POLICY IF EXISTS "property_select_policy" ON properties;
DROP POLICY IF EXISTS "property_access_policy" ON properties;
DROP POLICY IF EXISTS "property_update_policy" ON properties;
DROP POLICY IF EXISTS "property_owner_access" ON properties;
DROP POLICY IF EXISTS "property_base_access" ON properties;
DROP POLICY IF EXISTS "access_property" ON properties;
DROP POLICY IF EXISTS "access_properties" ON properties;
DROP POLICY IF EXISTS "base_property_access" ON properties;
DROP POLICY IF EXISTS "mv_property_access" ON properties;
DROP POLICY IF EXISTS "owner_access" ON properties;