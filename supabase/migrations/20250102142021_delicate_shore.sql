-- Step 1: Drop existing policies and views
DROP POLICY IF EXISTS "property_access_policy" ON properties;
DROP POLICY IF EXISTS "property_update_policy" ON properties;
DROP VIEW IF EXISTS property_access_details CASCADE;

-- Step 2: Create materialized views for access control
CREATE MATERIALIZED VIEW mv_property_access AS
SELECT DISTINCT
    p.id as property_id,
    p.created_by as owner_id,
    pa.user_id,
    pa.access_level
FROM properties p
LEFT JOIN property_access pa ON pa.property_id = p.id;

-- Step 3: Create unique index without using COALESCE
CREATE UNIQUE INDEX idx_mv_property_access_unique 
ON mv_property_access(property_id, owner_id)
WHERE user_id IS NULL;

CREATE UNIQUE INDEX idx_mv_property_access_user_unique
ON mv_property_access(property_id, user_id)
WHERE user_id IS NOT NULL;

-- Step 4: Create additional indexes for performance
CREATE INDEX idx_mv_property_access_user 
ON mv_property_access(user_id) 
WHERE user_id IS NOT NULL;

CREATE INDEX idx_mv_property_access_owner 
ON mv_property_access(owner_id);

-- Step 5: Create simplified property access policies
CREATE POLICY "property_read_access"
ON properties FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT property_id 
        FROM mv_property_access
        WHERE owner_id = auth.uid()
           OR user_id = auth.uid()
    )
);

CREATE POLICY "property_write_access"
ON properties FOR UPDATE
TO authenticated
USING (
    id IN (
        SELECT property_id 
        FROM mv_property_access
        WHERE owner_id = auth.uid()
           OR (user_id = auth.uid() AND access_level IN ('write', 'admin'))
    )
)
WITH CHECK (
    id IN (
        SELECT property_id 
        FROM mv_property_access
        WHERE owner_id = auth.uid()
           OR (user_id = auth.uid() AND access_level IN ('write', 'admin'))
    )
);

-- Step 6: Create refresh function and trigger
CREATE OR REPLACE FUNCTION refresh_property_access()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_property_access;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_property_access_trigger
AFTER INSERT OR UPDATE OR DELETE ON properties
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_property_access();

CREATE TRIGGER refresh_property_access_trigger
AFTER INSERT OR UPDATE OR DELETE ON property_access
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_property_access();

-- Step 7: Create view for property access details
CREATE VIEW property_access_details AS
SELECT 
    pa.id,
    pa.property_id,
    pa.user_id,
    pa.access_level,
    pa.created_at,
    pa.created_by,
    u.email as user_email,
    p.name as property_name
FROM property_access pa
JOIN auth.users u ON u.id = pa.user_id
JOIN properties p ON p.id = pa.property_id;

-- Step 8: Initial refresh of materialized view
REFRESH MATERIALIZED VIEW mv_property_access;