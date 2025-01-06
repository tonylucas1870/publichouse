/*
  # Update contents schema to support multiple images
  
  1. Changes
    - Add images array to contents items in room_details table
    - Update any existing single image_url data to images array format
*/

-- First update any existing content items to use images array
UPDATE room_details
SET contents = (
  SELECT jsonb_agg(
    CASE 
      WHEN jsonb_typeof(item -> 'image_url') = 'string' 
      THEN jsonb_set(
        item - 'image_url',
        '{images}',
        jsonb_build_array(item -> 'image_url')
      )
      ELSE jsonb_set(
        item,
        '{images}',
        '[]'::jsonb
      )
    END
  )
  FROM jsonb_array_elements(contents) item
)
WHERE jsonb_typeof(contents) = 'array';