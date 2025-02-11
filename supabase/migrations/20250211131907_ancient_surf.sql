-- Update demo property function to fix set-returning function error
CREATE OR REPLACE FUNCTION create_demo_property()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_id uuid;
  v_room_id uuid;
  v_changeover_id uuid;
  v_sofa_id uuid;
  v_microwave_id uuid;
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
    -- Create property
    INSERT INTO properties (
      name,
      address,
      created_by
    )
    VALUES (
      'Demo Property',
      '123 Demo Street, Example City',
      auth.uid()
    )
    RETURNING id INTO v_property_id;

    -- Create rooms
    INSERT INTO rooms (name, property_id) VALUES
      ('Living Room', v_property_id),
      ('Kitchen', v_property_id),
      ('Master Bedroom', v_property_id),
      ('Guest Bedroom', v_property_id),
      ('Bathroom', v_property_id);

    -- Generate UUIDs for content items
    v_sofa_id := gen_random_uuid();
    v_microwave_id := gen_random_uuid();

    -- Add room contents
    FOR v_room_id IN (SELECT id FROM rooms WHERE property_id = v_property_id)
    LOOP
      UPDATE room_details
      SET contents = CASE
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Living Room' THEN
          jsonb_build_array(
            jsonb_build_object(
              'id', v_sofa_id,
              'name', 'Sofa',
              'description', 'Gray 3-seater sofa',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'TV Stand',
              'description', 'Wooden TV stand with storage',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Coffee Table',
              'description', 'Glass top coffee table',
              'images', jsonb_build_array()
            )
          )
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Kitchen' THEN
          jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Refrigerator',
              'description', 'Stainless steel fridge',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Dishwasher',
              'description', 'Built-in dishwasher',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', v_microwave_id,
              'name', 'Microwave',
              'description', 'Countertop microwave',
              'images', jsonb_build_array()
            )
          )
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Master Bedroom' THEN
          jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'King Bed',
              'description', 'King size bed with frame',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Dresser',
              'description', '6-drawer dresser',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Nightstands',
              'description', 'Pair of matching nightstands',
              'images', jsonb_build_array()
            )
          )
        ELSE
          jsonb_build_array()
      END
      WHERE room_id = v_room_id;
    END LOOP;

    -- Create changeover
    INSERT INTO changeovers (
      property_id,
      checkin_date,
      checkout_date,
      status,
      created_by
    )
    VALUES (
      v_property_id,
      current_date + interval '1 day',
      current_date + interval '8 days',
      'scheduled',
      auth.uid()
    )
    RETURNING id INTO v_changeover_id;

    -- Create findings
    INSERT INTO findings (
      description,
      location,
      changeover_id,
      status,
      user_id,
      content_item,
      notes
    )
    VALUES
      (
        'Stain on sofa cushion',
        'Living Room',
        v_changeover_id,
        'open',
        auth.uid(),
        jsonb_build_object(
          'id', v_sofa_id,
          'name', 'Sofa',
          'description', 'Gray 3-seater sofa'
        ),
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
      ),
      (
        'Microwave not heating properly',
        'Kitchen',
        v_changeover_id,
        'blocked',
        auth.uid(),
        jsonb_build_object(
          'id', v_microwave_id,
          'name', 'Microwave',
          'description', 'Countertop microwave'
        ),
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
      );

    -- Create tasks
    INSERT INTO property_tasks (
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
        v_property_id,
        'Deep clean carpets',
        'Professional carpet cleaning service',
        'Living Room',
        auth.uid(),
        'month',
        3
      ),
      (
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