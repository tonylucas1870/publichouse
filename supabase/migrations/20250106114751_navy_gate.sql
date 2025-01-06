-- Drop existing trigger and function
DROP TRIGGER IF EXISTS create_room_details_trigger ON rooms;
DROP FUNCTION IF EXISTS create_default_room_details();

-- Create new function with proper JSONB array initialization
CREATE OR REPLACE FUNCTION create_default_room_details()
RETURNS TRIGGER AS $$
DECLARE
  empty_array jsonb := '[]'::jsonb;
BEGIN
  -- Verify the JSONB array type before insertion
  IF jsonb_typeof(empty_array) != 'array' THEN
    RAISE EXCEPTION 'Invalid JSONB array type';
  END IF;

  -- Insert with explicit JSONB arrays and validation
  INSERT INTO room_details (
    room_id,
    contents,
    walls,
    lighting
  )
  VALUES (
    NEW.id,
    empty_array,
    empty_array,
    empty_array
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER create_room_details_trigger
  AFTER INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION create_default_room_details();

-- Update any existing invalid room details
UPDATE room_details
SET 
  contents = CASE 
    WHEN jsonb_typeof(contents) != 'array' THEN '[]'::jsonb
    ELSE contents
  END,
  walls = CASE 
    WHEN jsonb_typeof(walls) != 'array' THEN '[]'::jsonb
    ELSE walls
  END,
  lighting = CASE 
    WHEN jsonb_typeof(lighting) != 'array' THEN '[]'::jsonb
    ELSE lighting
  END
WHERE
  jsonb_typeof(contents) != 'array'
  OR jsonb_typeof(walls) != 'array'
  OR jsonb_typeof(lighting) != 'array';