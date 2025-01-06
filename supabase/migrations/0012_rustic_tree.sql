/*
  # Add calendar URL to properties

  1. Changes
    - Add calendar_url column to properties table
    - Add calendar_url to existing policies
*/

-- Add calendar_url column to properties table
ALTER TABLE properties 
ADD COLUMN calendar_url text;