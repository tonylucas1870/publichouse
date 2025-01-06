/*
  # Simplified Property Access Structure
  
  1. Tables
    - property_access: Tracks who has access to each property
    
  2. Policies
    - Properties: Based on ownership and granted access
    - Changeovers: Based on property access or share token
    - Findings: Based on changeover access
    
  3. Indexes
    - Optimized for common access patterns
*/

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "access_property" ON properties;
DROP POLICY IF EXISTS "access_changeover" ON changeovers;
DROP POLICY IF EXISTS "access_finding" ON findings;
DROP POLICY IF EXISTS "write_finding" ON findings;
DROP POLICY IF EXISTS "access_own_records" ON property_access;
DROP POLICY IF EXISTS "admin_manage_access" ON property_access;

-- Step 2: Create property access table if not exists
CREATE TABLE IF NOT EXISTS property_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    access_level text NOT NULL CHECK (access_level IN ('read', 'write', 'admin')),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(property_id, user_id)
);

-- Enable RLS
ALTER TABLE property_access ENABLE ROW LEVEL SECURITY;

-- Step 3: Create property access table policies
CREATE POLICY "view_access"
ON property_access FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "manage_access"
ON property_access FOR ALL
TO authenticated
USING (
    property_id IN (
        SELECT p.id FROM properties p
        WHERE p.created_by = auth.uid()
    )
)
WITH CHECK (
    property_id IN (
        SELECT p.id FROM properties p
        WHERE p.created_by = auth.uid()
    )
);

-- Step 4: Create property policies using JOINs
CREATE POLICY "access_property"
ON properties FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT p.id FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.created_by = auth.uid()
           OR pa.user_id = auth.uid()
    )
);

-- Step 5: Create changeover policies using JOINs
CREATE POLICY "access_changeover"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL
    OR id IN (
        SELECT c.id FROM changeovers c
        JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.created_by = auth.uid()
           OR pa.user_id = auth.uid()
    )
);

-- Step 6: Create finding policies using JOINs
CREATE POLICY "access_finding"
ON findings FOR SELECT
USING (
    changeover_id IN (
        SELECT c.id FROM changeovers c
        LEFT JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE c.share_token IS NOT NULL
           OR p.created_by = auth.uid()
           OR pa.user_id = auth.uid()
    )
);

CREATE POLICY "write_finding"
ON findings FOR INSERT
WITH CHECK (
    changeover_id IN (
        SELECT c.id FROM changeovers c
        LEFT JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE (c.share_token IS NOT NULL)
           OR (p.created_by = auth.uid())
           OR (pa.user_id = auth.uid() AND pa.access_level IN ('write', 'admin'))
    )
);

CREATE POLICY "update_finding"
ON findings FOR UPDATE
USING (
    changeover_id IN (
        SELECT c.id FROM changeovers c
        JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.created_by = auth.uid()
           OR (pa.user_id = auth.uid() AND pa.access_level IN ('write', 'admin'))
    )
)
WITH CHECK (
    changeover_id IN (
        SELECT c.id FROM changeovers c
        JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.created_by = auth.uid()
           OR (pa.user_id = auth.uid() AND pa.access_level IN ('write', 'admin'))
    )
);

-- Step 7: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_property_access_user_id ON property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property_id ON property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_property_access_level ON property_access(access_level);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);

-- Step 8: Migrate existing property owners to property_access
INSERT INTO property_access (property_id, user_id, access_level, created_by)
SELECT id, created_by, 'admin', created_by
FROM properties
ON CONFLICT (property_id, user_id) DO NOTHING;