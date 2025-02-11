-- Update demo property function with proper UUIDs
CREATE OR REPLACE FUNCTION create_demo_property()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_id uuid;
  v_room_id uuid;
  v_changeover_id uuid;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if demo property already exists
  SELECT id INTO v_property_id
  FROM properties
  WHERE name = 'Demo Property'
  AND created_by = auth.uid();

  -- Create demo property if it doesn't exist
  IF v_property_id IS NULL THEN
    INSERT INTO properties (
      id,
      name,
      address,
      created_by,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      'Demo Property',
      '123 Demo Street, Example City',
      auth.uid(),
      now()
    )
    RETURNING id INTO v_property_id;

    -- Create rooms
    INSERT INTO rooms (id, name, property_id) VALUES
      (gen_random_uuid(), 'Living Room', v_property_id),
      (gen_random_uuid(), 'Kitchen', v_property_id),
      (gen_random_uuid(), 'Master Bedroom', v_property_id),
      (gen_random_uuid(), 'Guest Bedroom', v_property_id),
      (gen_random_uuid(), 'Bathroom', v_property_id);

    -- Add room contents
    FOR v_room_id IN (SELECT id FROM rooms WHERE property_id = v_property_id)
    LOOP
      UPDATE room_details
      SET contents = CASE
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Living Room' THEN
          '[
            {"id": "'||gen_random_uuid()||'", "name": "Sofa", "description": "Gray 3-seater sofa", "images": []},
            {"id": "'||gen_random_uuid()||'", "name": "TV Stand", "description": "Wooden TV stand with storage", "images": []},
            {"id": "'||gen_random_uuid()||'", "name": "Coffee Table", "description": "Glass top coffee table", "images": []}
          ]'::jsonb
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Kitchen' THEN
          '[
            {"id": "'||gen_random_uuid()||'", "name": "Refrigerator", "description": "Stainless steel fridge", "images": []},
            {"id": "'||gen_random_uuid()||'", "name": "Dishwasher", "description": "Built-in dishwasher", "images": []},
            {"id": "'||gen_random_uuid()||'", "name": "Microwave", "description": "Countertop microwave", "images": []}
          ]'::jsonb
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Master Bedroom' THEN
          '[
            {"id": "'||gen_random_uuid()||'", "name": "King Bed", "description": "King size bed with frame", "images": []},
            {"id": "'||gen_random_uuid()||'", "name": "Dresser", "description": "6-drawer dresser", "images": []},
            {"id": "'||gen_random_uuid()||'", "name": "Nightstands", "description": "Pair of matching nightstands", "images": []}
          ]'::jsonb
        ELSE
          '[]'::jsonb
      END
      WHERE room_id = v_room_id;
    END LOOP;

    -- Create changeover
    INSERT INTO changeovers (
      id,
      property_id,
      checkin_date,
      checkout_date,
      status,
      created_by,
      share_token
    )
    VALUES (
      gen_random_uuid(),
      v_property_id,
      current_date + interval '1 day',
      current_date + interval '8 days',
      'scheduled',
      auth.uid(),
      encode(gen_random_bytes(32), 'hex')
    )
    RETURNING id INTO v_changeover_id;

    -- Create findings
    WITH sofa AS (
      SELECT jsonb_array_elements(contents)->>'id' as id
      FROM room_details rd
      JOIN rooms r ON r.id = rd.room_id
      WHERE r.property_id = v_property_id
      AND r.name = 'Living Room'
      AND (jsonb_array_elements(contents)->>'name') = 'Sofa'
      LIMIT 1
    ),
    microwave AS (
      SELECT jsonb_array_elements(contents)->>'id' as id
      FROM room_details rd
      JOIN rooms r ON r.id = rd.room_id
      WHERE r.property_id = v_property_id
      AND r.name = 'Kitchen'
      AND (jsonb_array_elements(contents)->>'name') = 'Microwave'
      LIMIT 1
    )
    INSERT INTO findings (
      id,
      description,
      location,
      changeover_id,
      status,
      user_id,
      content_item,
      images,
      notes
    )
    SELECT
      gen_random_uuid(),
      'Stain on sofa cushion',
      'Living Room',
      v_changeover_id,
      'open',
      auth.uid(),
      jsonb_build_object(
        'id', sofa.id,
        'name', 'Sofa',
        'description', 'Gray 3-seater sofa'
      ),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'text', 'Will need professional cleaning',
          'created_at', now(),
          'author', jsonb_build_object(
            'type', 'authenticated',
            'id', auth.uid(),
            'display_name', 'You'
          )
        )
      )
    FROM sofa
    UNION ALL
    SELECT
      gen_random_uuid(),
      'Microwave not heating properly',
      'Kitchen',
      v_changeover_id,
      'blocked',
      auth.uid(),
      jsonb_build_object(
        'id', microwave.id,
        'name', 'Microwave',
        'description', 'Countertop microwave'
      ),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'text', 'Waiting for repair service availability',
          'created_at', now(),
          'author', jsonb_build_object(
            'type', 'authenticated',
            'id', auth.uid(),
            'display_name', 'You'
          )
        )
      )
    FROM microwave;

    -- Create tasks
    INSERT INTO property_tasks (
      id,
      property_id,
      title,
      description,
      location,
      created_by,
      scheduling_type,
      interval
    )
    VALUES
      (
        gen_random_uuid(),
        v_property_id,
        'Deep clean carpets',
        'Professional carpet cleaning service',
        'Living Room',
        auth.uid(),
        'month',
        3
      ),
      (
        gen_random_uuid(),
        v_property_id,
        'Check appliances',
        'Test all kitchen appliances for proper operation',
        'Kitchen',
        auth.uid(),
        'changeover',
        1
      );
  END IF;

  RETURN v_property_id;
END;
$$;