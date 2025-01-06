/*
  # Add array constraints to room details
  
  1. Changes
    - Add constraints to ensure contents, walls, and lighting are arrays
    - Update any existing non-array data to empty arrays
*/

-- First update any non-array data to empty arrays
UPDATE room_details 
SET 
  contents = CASE 
    WHEN contents IS NULL OR jsonb_typeof(contents) != 'array' 
    THEN '[]'::jsonb 
    ELSE contents 
  END,
  walls = CASE 
    WHEN walls IS NULL OR jsonb_typeof(walls) != 'array' 
    THEN '[]'::jsonb 
    ELSE walls 
  END,
  lighting = CASE 
    WHEN lighting IS NULL OR jsonb_typeof(lighting) != 'array' 
    THEN '[]'::jsonb 
    ELSE lighting 
  END;

-- Then add the array constraints
ALTER TABLE room_details
ADD CONSTRAINT contents_is_array CHECK (jsonb_typeof(contents) = 'array'),
ADD CONSTRAINT walls_is_array CHECK (jsonb_typeof(walls) = 'array'),
ADD CONSTRAINT lighting_is_array CHECK (jsonb_typeof(lighting) = 'array');