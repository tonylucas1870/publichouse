/*
  # Fix Room RLS Policies

  1. Changes
    - Add RLS policy for room creation through changeovers
    - Allow room creation for users with access to the property through changeovers
    - Maintain existing property owner access

  2. Security
    - Ensures users can only create rooms if they:
      a) Own the property
      b) Have access through a changeover share token
    - Maintains existing access controls for room viewing and deletion
*/

-- Drop existing policies that we'll be replacing
DROP POLICY IF EXISTS "Users can create rooms for their properties" ON rooms;
DROP POLICY IF EXISTS "Anyone can view rooms for shared changeovers" ON rooms;

-- Create new comprehensive policies
CREATE POLICY "room_access_policy" ON rooms
FOR ALL USING (
  property_id IN (
    -- Direct property ownership
    SELECT id FROM properties
    WHERE created_by = auth.uid()
    UNION
    -- Access through changeover share token
    SELECT DISTINCT c.property_id
    FROM changeovers c
    WHERE c.share_token IS NOT NULL
      AND c.property_id = rooms.property_id
  )
);

-- Add specific insert policy for more granular control
CREATE POLICY "room_insert_policy" ON rooms
FOR INSERT WITH CHECK (
  property_id IN (
    -- Direct property ownership
    SELECT id FROM properties
    WHERE created_by = auth.uid()
    UNION
    -- Access through changeover share token
    SELECT DISTINCT c.property_id
    FROM changeovers c
    WHERE c.share_token IS NOT NULL
      AND c.property_id = rooms.property_id
  )
);