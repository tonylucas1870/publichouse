-- Drop existing trigger and function
DROP TRIGGER IF EXISTS create_room_details_trigger ON rooms;
DROP FUNCTION IF EXISTS create_default_room_details();

-- Create new function with proper JSONB array initialization
CREATE OR REPLACE FUNCTION create_default_room_details()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert with explicit JSONB arrays to satisfy constraints
  INSERT INTO room_details (
    room_id,
    contents,
    walls,
    lighting
  )
  VALUES (
    NEW.id,
    jsonb_build_array(),  -- Creates a proper empty JSONB array
    jsonb_build_array(),  -- Creates a proper empty JSONB array
    jsonb_build_array()   -- Creates a proper empty JSONB array
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
    WHEN jsonb_typeof(contents) != 'array' THEN jsonb_build_array()
    ELSE contents
  END,
  walls = CASE 
    WHEN jsonb_typeof(walls) != 'array' THEN jsonb_build_array()
    ELSE walls
  END,
  lighting = CASE 
    WHEN jsonb_typeof(lighting) != 'array' THEN jsonb_build_array()
    ELSE lighting
  END;