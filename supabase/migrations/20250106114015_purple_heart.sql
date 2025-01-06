-- Drop existing trigger first
DROP TRIGGER IF EXISTS create_room_details_trigger ON rooms;
DROP FUNCTION IF EXISTS create_default_room_details();

-- Create new function with correct column names
CREATE OR REPLACE FUNCTION create_default_room_details()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO room_details (room_id, contents, walls, lighting)
  VALUES (
    NEW.id,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to create default room details
CREATE TRIGGER create_room_details_trigger
  AFTER INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION create_default_room_details();