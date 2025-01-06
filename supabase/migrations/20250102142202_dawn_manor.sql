-- Drop existing function if it exists
DROP FUNCTION IF EXISTS manage_property_access;

-- Recreate function with proper column qualification
CREATE OR REPLACE FUNCTION manage_property_access(
    input_property_id uuid,
    user_email text,
    access_level property_access_level
)
RETURNS property_access
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id uuid;
    access_record property_access;
BEGIN
    -- Check if user has permission to manage access
    IF NOT EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = input_property_id
        AND p.created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized to manage access for this property';
    END IF;

    -- Get user ID from email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = user_email;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', user_email;
    END IF;

    -- Insert or update access record
    INSERT INTO property_access (
        property_id,
        user_id,
        access_level,
        created_by
    )
    VALUES (
        input_property_id,
        target_user_id,
        access_level,
        auth.uid()
    )
    ON CONFLICT (property_id, user_id)
    DO UPDATE SET
        access_level = EXCLUDED.access_level
    RETURNING * INTO access_record;

    RETURN access_record;
END;
$$;