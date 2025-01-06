/*
  # Update room details schema for contents - Part 5

  1. Changes
    - Create updated_at trigger
*/

-- Create trigger function
CREATE OR REPLACE FUNCTION update_room_details_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_room_details_timestamp
  BEFORE UPDATE ON room_details
  FOR EACH ROW
  EXECUTE FUNCTION update_room_details_updated_at();