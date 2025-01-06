-- Step 1: Drop existing check constraint
ALTER TABLE property_access DROP CONSTRAINT IF EXISTS property_access_access_level_check;

-- Step 2: Add new check constraint with correct access levels
ALTER TABLE property_access 
ADD CONSTRAINT property_access_access_level_check 
CHECK (access_level IN ('cleaner', 'maintenance', 'admin'));

-- Step 3: Update any existing invalid access levels
UPDATE property_access
SET access_level = 'admin'
WHERE access_level NOT IN ('cleaner', 'maintenance', 'admin');