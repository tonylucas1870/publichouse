/*
  # Add UUIDs to content items

  1. Changes
    - Adds UUID field to content items in room_details table
    - Updates content_item references in findings table
    - Adds validation to ensure content items have UUIDs

  2. Security
    - No changes to RLS policies needed
*/

-- Function to add UUIDs to existing content items
CREATE OR REPLACE FUNCTION add_uuids_to_content_items()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Update room_details content items
  FOR r IN SELECT id, contents FROM room_details WHERE jsonb_array_length(contents) > 0
  LOOP
    UPDATE room_details
    SET contents = (
      SELECT jsonb_agg(
        CASE
          WHEN item ? 'id' THEN item
          ELSE jsonb_set(item, '{id}', to_jsonb(gen_random_uuid()::text))
        END
      )
      FROM jsonb_array_elements(r.contents) item
    )
    WHERE id = r.id;
  END LOOP;

  -- Update findings content_item references
  FOR r IN SELECT id, content_item FROM findings WHERE content_item IS NOT NULL
  LOOP
    UPDATE findings
    SET content_item = 
      CASE
        WHEN content_item ? 'id' THEN content_item
        ELSE jsonb_set(content_item, '{id}', to_jsonb(gen_random_uuid()::text))
      END
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Add validation function for content items
CREATE OR REPLACE FUNCTION validate_content_items(contents jsonb)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if all content items have UUIDs
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(contents) item
    WHERE NOT (item ? 'id')
       OR NOT (item->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'All content items must have valid UUIDs';
  END IF;

  RETURN true;
END;
$$;

-- Add trigger to validate content items
CREATE OR REPLACE FUNCTION validate_content_items_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contents IS NOT NULL THEN
    PERFORM validate_content_items(NEW.contents);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS validate_content_items_trigger ON room_details;
CREATE TRIGGER validate_content_items_trigger
  BEFORE INSERT OR UPDATE ON room_details
  FOR EACH ROW
  EXECUTE FUNCTION validate_content_items_trigger();

-- Run migration on existing data
SELECT add_uuids_to_content_items();