-- Step 1: Create policy for pending findings
CREATE POLICY "pending_findings_access"
ON findings FOR SELECT
USING (
    status = 'pending'
    AND EXISTS (
        SELECT 1 FROM changeovers c
        WHERE c.id = changeover_id
        AND EXISTS (
            SELECT 1 FROM properties p
            LEFT JOIN property_access pa ON pa.property_id = p.id
            WHERE p.id = c.property_id
            AND (
                p.created_by = auth.uid()
                OR (pa.user_id = auth.uid() AND pa.access_level IN ('cleaner', 'maintenance', 'admin'))
            )
        )
    )
);

-- Step 2: Create optimized index for pending findings
CREATE INDEX IF NOT EXISTS idx_findings_status 
ON findings(status) 
WHERE status = 'pending';