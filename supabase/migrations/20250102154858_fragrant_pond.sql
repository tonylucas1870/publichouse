-- Step 1: Drop existing function first
DROP FUNCTION IF EXISTS manage_property_access;

-- Step 2: Create function with properly named parameters
CREATE OR REPLACE FUNCTION manage_property_access(
    property_id_input uuid,
    email_input text,
    level_input text
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
        WHERE p.id = property_id_input
        AND p.created_by = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized to manage access for this property';
    END IF;

    -- Validate access level
    IF level_input NOT IN ('read', 'write', 'admin') THEN
        RAISE EXCEPTION 'Invalid access level. Must be read, write, or admin';
    END IF;

    -- Get user ID from email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = email_input;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', email_input;
    END IF;

    -- Insert or update access record
    INSERT INTO property_access (
        property_id,
        user_id,
        access_level,
        created_by
    )
    VALUES (
        property_id_input,
        target_user_id,
        level_input,
        auth.uid()
    )
    ON CONFLICT (property_id, user_id)
    DO UPDATE SET
        access_level = EXCLUDED.access_level
    RETURNING * INTO access_record;

    RETURN access_record;
END;
$$;