/*
  # Calendar Integration Schema Updates

  1. Changes
    - Add calendar_sync_status to properties table
    - Add calendar_last_synced to properties table
    - Add calendar_sync_error to properties table
    - Add calendar_booking_id to changeovers table
    - Add calendar_sync_status enum type

  2. Security
    - Update RLS policies to allow calendar sync updates
*/

-- Create calendar sync status enum
CREATE TYPE calendar_sync_status AS ENUM ('pending', 'synced', 'failed');

-- Add calendar sync fields to properties table
ALTER TABLE properties
ADD COLUMN calendar_sync_status calendar_sync_status DEFAULT 'pending',
ADD COLUMN calendar_last_synced timestamptz,
ADD COLUMN calendar_sync_error text;

-- Add calendar booking ID to changeovers
ALTER TABLE changeovers
ADD COLUMN calendar_booking_id text;

-- Add index for calendar booking ID lookups
CREATE INDEX changeovers_calendar_booking_idx ON changeovers(calendar_booking_id);

-- Update properties policy to allow calendar sync updates
CREATE POLICY "Users can update calendar sync status"
ON properties
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());