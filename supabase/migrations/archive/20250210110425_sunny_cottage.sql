-- Add function to analyze video content
CREATE OR REPLACE FUNCTION analyze_video_content(
  p_video_url text,
  p_property_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rooms jsonb;
  v_content_items jsonb;
BEGIN
  -- Get rooms for property
  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id,
    'name', r.name
  ))
  INTO v_rooms
  FROM rooms r
  WHERE r.property_id = p_property_id;

  -- Get content items for property
  SELECT jsonb_agg(DISTINCT c.content_item)
  INTO v_content_items
  FROM room_details rd
  JOIN rooms r ON r.id = rd.room_id,
  jsonb_array_elements(rd.contents) c(content_item)
  WHERE r.property_id = p_property_id;

  -- Return context for analysis
  RETURN jsonb_build_object(
    'rooms', COALESCE(v_rooms, '[]'::jsonb),
    'content_items', COALESCE(v_content_items, '[]'::jsonb)
  );
END;
$$;