-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "owner_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;

-- Step 2: Create property access table
CREATE TABLE IF NOT EXISTS property_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    access_level text CHECK (access_level IN ('read', 'write', 'admin')),
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(property_id, user_id)
);

-- Enable RLS on property_access
ALTER TABLE property_access ENABLE ROW LEVEL SECURITY;

-- Step 3: Create trigger to automatically add owner access
CREATE OR REPLACE FUNCTION add_owner_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO property_access (property_id, user_id, access_level, created_by)
    VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_owner_access
    AFTER INSERT ON properties
    FOR EACH ROW
    EXECUTE FUNCTION add_owner_access();

-- Step 4: Create simple non-recursive policies
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT property_id 
        FROM property_access 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL
    OR property_id IN (
        SELECT property_id 
        FROM property_access 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "finding_select"
ON findings FOR SELECT
USING (
    changeover_id IN (
        SELECT id FROM changeovers
        WHERE share_token IS NOT NULL
        OR property_id IN (
            SELECT property_id 
            FROM property_access 
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "finding_insert"
ON findings FOR INSERT
WITH CHECK (
    changeover_id IN (
        SELECT id FROM changeovers
        WHERE share_token IS NOT NULL
        OR property_id IN (
            SELECT property_id 
            FROM property_access 
            WHERE user_id = auth.uid()
            AND access_level IN ('write', 'admin')
        )
    )
);

CREATE POLICY "finding_update"
ON findings FOR UPDATE
USING (
    changeover_id IN (
        SELECT id FROM changeovers
        WHERE property_id IN (
            SELECT property_id 
            FROM property_access 
            WHERE user_id = auth.uid()
            AND access_level IN ('write', 'admin')
        )
    )
)
WITH CHECK (
    changeover_id IN (
        SELECT id FROM changeovers
        WHERE property_id IN (
            SELECT property_id 
            FROM property_access 
            WHERE user_id = auth.uid()
            AND access_level IN ('write', 'admin')
        )
    )
);

-- Step 5: Create property access policies
CREATE POLICY "manage_property_access"
ON property_access
FOR ALL
TO authenticated
USING (
    property_id IN (
        SELECT property_id
        FROM property_access
        WHERE user_id = auth.uid()
        AND access_level = 'admin'
    )
)
WITH CHECK (
    property_id IN (
        SELECT property_id
        FROM property_access
        WHERE user_id = auth.uid()
        AND access_level = 'admin'
    )
);

-- Step 6: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_property_access_user_id ON property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property_id ON property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_property_access_level ON property_access(access_level);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);

-- Step 7: Migrate existing property owners to property_access
INSERT INTO property_access (property_id, user_id, access_level, created_by)
SELECT id, created_by, 'admin', created_by
FROM properties
ON CONFLICT (property_id, user_id) DO NOTHING;