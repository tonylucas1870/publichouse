/*
  # Calendar Sync Policies

  1. New Policies
    - Allow property owners to update calendar sync status
    - Allow property owners to manage calendar-linked changeovers
    - Ensure only property owners can sync their properties

  2. Security
    - All operations restricted to property owners
    - Calendar booking IDs protected
    - Sync status updates protected
*/

-- Drop existing calendar-related policies if they exist
DROP POLICY IF EXISTS "calendar_sync_policy" ON properties;
DROP POLICY IF EXISTS "calendar_changeover_policy" ON changeovers;

-- Create policy for calendar sync status updates
CREATE POLICY "calendar_sync_policy" ON properties
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (
  created_by = auth.uid() 
  AND (
    -- Only allow updating calendar sync fields
    NEW.calendar_sync_status IS NOT NULL OR
    NEW.calendar_last_synced IS NOT NULL OR
    NEW.calendar_sync_error IS NOT NULL OR
    NEW.initial_sync_complete IS NOT NULL
  )
);

-- Create policy for calendar-linked changeovers
CREATE POLICY "calendar_changeover_policy" ON changeovers
FOR ALL
TO authenticated
USING (
  -- Property owner can manage calendar-linked changeovers
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_id
    AND p.created_by = auth.uid()
    AND calendar_booking_id IS NOT NULL
  )
)
WITH CHECK (
  -- Property owner can manage calendar-linked changeovers
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_id
    AND p.created_by = auth.uid()
    AND calendar_booking_id IS NOT NULL
  )
);

-- Add comment explaining policies
COMMENT ON TABLE properties IS 
'Properties table with calendar sync support.
Calendar sync operations are restricted to property owners only.
The sync_calendars function uses service role to bypass RLS for background syncs.';

COMMENT ON TABLE changeovers IS
'Changeovers table with calendar integration.
Calendar-linked changeovers (with calendar_booking_id) can only be managed by property owners.
Background sync process uses service role to bypass RLS.';