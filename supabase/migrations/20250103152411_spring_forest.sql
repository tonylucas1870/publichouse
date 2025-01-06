-- Add content_item column to findings table
ALTER TABLE findings
ADD COLUMN content_item jsonb;

-- Create index for content_item queries
CREATE INDEX idx_findings_content_item ON findings USING gin(content_item);

-- Update RLS policies to include content_item
DROP POLICY IF EXISTS "finding_select" ON findings;
DROP POLICY IF EXISTS "finding_insert" ON findings;

CREATE POLICY "finding_select"
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