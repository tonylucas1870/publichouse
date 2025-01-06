-- Create default room details on room creation
CREATE OR REPLACE FUNCTION create_default_room_details()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO room_details (room_id, furniture, walls, lighting)
  VALUES (
    NEW.id,
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to create default room details
CREATE TRIGGER create_room_details_trigger
  AFTER INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION create_default_room_details();