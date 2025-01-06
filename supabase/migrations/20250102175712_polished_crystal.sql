/*
  # Fix Property Access Policies

  1. Changes
    - Drop existing property access policies
    - Create new policy for property access that allows proper joins
    - Create policy for changeover access that respects property access
    - Add optimized indexes for performance

  2. Security
    - Maintains RLS security model
    - Only allows access to properties user has rights to
    - Preserves share token access for changeovers
*/

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "access_through_property_access" ON properties;

-- Step 2: Create new property access policy
CREATE POLICY "property_access_with_joins"
ON properties FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT property_id FROM property_access
        WHERE user_id = auth.uid()
        UNION
        SELECT id FROM properties
        WHERE created_by = auth.uid()
    )
);

-- Step 3: Create changeover access policy
CREATE POLICY "changeover_access_with_joins"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL
    OR property_id IN (
        SELECT property_id FROM property_access
        WHERE user_id = auth.uid()
        UNION
        SELECT id FROM properties
        WHERE created_by = auth.uid()
    )
);

-- Step 4: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_property_access_composite 
ON property_access(user_id, property_id);

CREATE INDEX IF NOT EXISTS idx_properties_created_by 
ON properties(created_by);

CREATE INDEX IF NOT EXISTS idx_changeovers_property_lookup
ON changeovers(property_id, share_token);