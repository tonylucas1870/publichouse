/*
  # Fix Room RLS Policies Again

  1. Changes
    - Simplify RLS policies to handle both direct property access and changeover access
    - Add explicit policies for each operation type
    - Ensure proper access through changeover share tokens

  2. Security
    - Maintains strict access control while allowing necessary operations
    - Prevents unauthorized access while enabling shared changeover functionality
*/

-- Drop existing policies
DROP POLICY IF EXISTS "room_access_policy" ON rooms;
DROP POLICY IF EXISTS "room_insert_policy" ON rooms;

-- Create separate policies for each operation type
CREATE POLICY "rooms_select_policy" ON rooms
FOR SELECT USING (
  property_id IN (
    -- Property owner access
    SELECT id FROM properties
    WHERE created_by = auth.uid()
    UNION
    -- Changeover share token access
    SELECT c.property_id
    FROM changeovers c
    WHERE c.share_token IS NOT NULL
      AND c.property_id = rooms.property_id
  )
);

CREATE POLICY "rooms_insert_policy" ON rooms
FOR INSERT WITH CHECK (
  property_id IN (
    -- Property owner access
    SELECT id FROM properties
    WHERE created_by = auth.uid()
    UNION
    -- Changeover share token access
    SELECT c.property_id
    FROM changeovers c
    WHERE c.share_token IS NOT NULL
      AND c.property_id = rooms.property_id
  )
);

CREATE POLICY "rooms_update_policy" ON rooms
FOR UPDATE USING (
  property_id IN (
    SELECT id FROM properties
    WHERE created_by = auth.uid()
  )
) WITH CHECK (
  property_id IN (
    SELECT id FROM properties
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "rooms_delete_policy" ON rooms
FOR DELETE USING (
  property_id IN (
    SELECT id FROM properties
    WHERE created_by = auth.uid()
  )
);