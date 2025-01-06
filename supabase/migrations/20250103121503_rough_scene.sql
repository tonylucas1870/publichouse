/*
  # Remove Property Access System
  
  1. Changes
    - Drop property_access table and related objects
    - Create simplified property access policies
    - Maintain share token functionality for changeovers
    - Clean up indexes

  2. Security
    - Properties only accessible by owner
    - Changeovers accessible by property owner or via share token
    - Findings accessible through changeover access
*/

-- Step 1: Drop property access table and related objects
DROP TABLE IF EXISTS property_access CASCADE;
DROP FUNCTION IF EXISTS manage_property_access CASCADE;
DROP FUNCTION IF EXISTS get_property_access CASCADE;
DROP VIEW IF EXISTS property_access_details CASCADE;

-- Step 2: Create simplified property policies
CREATE POLICY "owner_access"
ON properties FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "owner_update"
ON properties FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Step 3: Create changeover policies
CREATE POLICY "changeover_access"
ON changeovers FOR SELECT
USING (
    share_token IS NOT NULL
    OR property_id IN (
        SELECT id FROM properties
        WHERE created_by = auth.uid()
    )
);

-- Step 4: Create finding policies
CREATE POLICY "finding_access"
ON findings FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND (
            c.share_token IS NOT NULL
            OR EXISTS (
                SELECT 1 FROM properties p
                WHERE p.id = c.property_id
                AND p.created_by = auth.uid()
            )
        )
    )
);

CREATE POLICY "finding_insert"
ON findings FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND (
            c.share_token IS NOT NULL
            OR EXISTS (
                SELECT 1 FROM properties p
                WHERE p.id = c.property_id
                AND p.created_by = auth.uid()
            )
        )
    )
);

CREATE POLICY "finding_update"
ON findings FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = c.property_id
            AND p.created_by = auth.uid()
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND EXISTS (
            SELECT 1 FROM properties p
            WHERE p.id = c.property_id
            AND p.created_by = auth.uid()
        )
    )
);

-- Step 5: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);