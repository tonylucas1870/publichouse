-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "property_access" ON properties;
DROP POLICY IF EXISTS "changeover_access" ON changeovers;
DROP POLICY IF EXISTS "finding_access" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;
DROP POLICY IF EXISTS "finding_update" ON findings;
DROP POLICY IF EXISTS "pending_findings_access" ON findings;
DROP POLICY IF EXISTS "property_management_access" ON properties;
DROP POLICY IF EXISTS "room_management_access" ON rooms;
DROP POLICY IF EXISTS "room_update_access" ON rooms;
DROP POLICY IF EXISTS "room_delete_access" ON rooms;
DROP POLICY IF EXISTS "utility_management_access" ON utilities;

-- Step 2: Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE changeovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilities ENABLE ROW LEVEL SECURITY;

-- Step 3: Create property access policies
CREATE POLICY "property_access"
ON properties FOR SELECT
TO authenticated
USING (
    created_by = auth.uid()  -- Property owner
    OR EXISTS (              -- User with granted access
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
    )
);

CREATE POLICY "property_write_access"
ON properties FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid()  -- Property owner
    OR EXISTS (              -- Admin access
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
)
WITH CHECK (
    created_by = auth.uid()  -- Property owner
    OR EXISTS (              -- Admin access
        SELECT 1 FROM property_access pa
        WHERE pa.property_id = id
        AND pa.user_id = auth.uid()
        AND pa.access_level = 'admin'
    )
);

-- Step 4: Create changeover access policies
CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL  -- Public share access
    OR EXISTS (              -- Property access
        SELECT 1 FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR pa.user_id = auth.uid()
        )
    )
);

-- Step 5: Create finding policies
CREATE POLICY "finding_access"
ON findings FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND (
            c.share_token IS NOT NULL  -- Public share access
            OR EXISTS (                -- Property access
                SELECT 1 FROM properties p
                LEFT JOIN property_access pa ON pa.property_id = p.id
                WHERE p.id = c.property_id
                AND (
                    p.created_by = auth.uid()
                    OR pa.user_id = auth.uid()
                )
            )
        )
    )
);

CREATE POLICY "finding_write_access"
ON findings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND (
            c.share_token IS NOT NULL  -- Allow insert for shared changeovers
            OR EXISTS (                -- Property access check
                SELECT 1 FROM properties p
                LEFT JOIN property_access pa ON pa.property_id = p.id
                WHERE p.id = c.property_id
                AND (
                    p.created_by = auth.uid()
                    OR (pa.user_id = auth.uid() AND pa.access_level IN ('maintenance', 'admin'))
                )
            )
        )
    )
);

CREATE POLICY "finding_update_access"
ON findings FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM changeovers c
        JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE c.id = changeover_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level IN ('maintenance', 'admin'))
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM changeovers c
        JOIN properties p ON p.id = c.property_id
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE c.id = changeover_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level IN ('maintenance', 'admin'))
        )
    )
);

-- Step 6: Create room access policies
CREATE POLICY "room_access"
ON rooms FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR pa.user_id = auth.uid()
        )
    )
);

CREATE POLICY "room_write_access"
ON rooms FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level = 'admin')
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level = 'admin')
        )
    )
);

-- Step 7: Create utility access policies
CREATE POLICY "utility_access"
ON utilities FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR pa.user_id = auth.uid()
        )
    )
);

CREATE POLICY "utility_write_access"
ON utilities FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level = 'admin')
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM properties p
        LEFT JOIN property_access pa ON pa.property_id = p.id
        WHERE p.id = property_id
        AND (
            p.created_by = auth.uid()
            OR (pa.user_id = auth.uid() AND pa.access_level = 'admin')
        )
    )
);

-- Step 8: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_property_access_user_id ON property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property_id ON property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_property_access_level ON property_access(access_level);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);