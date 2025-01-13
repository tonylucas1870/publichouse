-- Drop the existing constraint
ALTER TABLE findings
DROP CONSTRAINT IF EXISTS findings_images_not_empty;

-- Add new constraint to ensure images is an array but can be empty
ALTER TABLE findings
ADD CONSTRAINT findings_images_is_array CHECK (jsonb_typeof(images) = 'array');

-- Update any existing findings with null images to empty array
UPDATE findings 
SET images = '[]'::jsonb 
WHERE images IS NULL;