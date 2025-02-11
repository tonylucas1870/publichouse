-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS create_demo_property();
DROP FUNCTION IF EXISTS get_demo_property();

-- Create function to get demo property
CREATE OR REPLACE FUNCTION get_demo_property()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_id uuid;
BEGIN
  SELECT id INTO v_property_id
  FROM properties
  WHERE name = 'Demo Property'
  AND created_by = auth.uid();
  
  RETURN v_property_id;
END;
$$;

-- Create function to set up demo property
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
            {"id": "d1", "name": "Sofa", "description": "Gray 3-seater sofa", "images": []},
            {"id": "d2", "name": "TV Stand", "description": "Wooden TV stand with storage", "images": []},
            {"id": "d3", "name": "Coffee Table", "description": "Glass top coffee table", "images": []}
          ]'::jsonb
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Kitchen' THEN
          '[
            {"id": "d4", "name": "Refrigerator", "description": "Stainless steel fridge", "images": []},
            {"id": "d5", "name": "Dishwasher", "description": "Built-in dishwasher", "images": []},
            {"id": "d6", "name": "Microwave", "description": "Countertop microwave", "images": []}
          ]'::jsonb
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Master Bedroom' THEN
          '[
            {"id": "d7", "name": "King Bed", "description": "King size bed with frame", "images": []},
            {"id": "d8", "name": "Dresser", "description": "6-drawer dresser", "images": []},
            {"id": "d9", "name": "Nightstands", "description": "Pair of matching nightstands", "images": []}
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
    VALUES
      (
        gen_random_uuid(),
        'Stain on sofa cushion',
        'Living Room',
        v_changeover_id,
        'open',
        auth.uid(),
        '{"id": "d1", "name": "Sofa", "description": "Gray 3-seater sofa"}',
        '[]',
        '[{"text": "Will need professional cleaning", "created_at": now(), "author": {"type": "authenticated", "id": "'||auth.uid()||'", "display_name": "You"}}]'
      ),
      (
        gen_random_uuid(),
        'Microwave not heating properly',
        'Kitchen',
        v_changeover_id,
        'blocked',
        auth.uid(),
        '{"id": "d6", "name": "Microwave", "description": "Countertop microwave"}',
        '[]',
        '[{"text": "Waiting for repair service availability", "created_at": now(), "author": {"type": "authenticated", "id": "'||auth.uid()||'", "display_name": "You"}}]'
      );

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