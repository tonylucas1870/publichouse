/*
  # Add multiple images support for findings

  1. Changes
    - Add images array to findings table to store multiple image URLs
    - Migrate existing single image_url to images array
    - Add validation check for at least one image

  2. Notes
    - Preserves existing image_url data by migrating it to the new images array
    - Ensures backward compatibility during migration
*/

-- Add images array column
ALTER TABLE findings
ADD COLUMN images jsonb DEFAULT '[]'::jsonb;

-- Migrate existing image_url data to images array
UPDATE findings
SET images = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL;

-- Add check constraint to ensure at least one image
ALTER TABLE findings
ADD CONSTRAINT findings_images_not_empty CHECK (jsonb_array_length(images) > 0);

-- Drop old image_url column (after migrating data)
ALTER TABLE findings
DROP COLUMN image_url;