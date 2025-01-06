-- Create function to get current version
CREATE OR REPLACE FUNCTION get_current_version()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT MAX(version)::integer 
    FROM supabase_migrations.schema_migrations
  );
END;
$$;

-- Create function to rollback to a specific version
CREATE OR REPLACE FUNCTION rollback_to_version(target_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only allow rolling back to valid versions
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations 
    WHERE version::integer = target_version
  ) THEN
    RAISE EXCEPTION 'Invalid version number';
  END IF;

  -- Perform rollback
  DELETE FROM supabase_migrations.schema_migrations
  WHERE version::integer > target_version;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_current_version() TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_to_version(integer) TO authenticated;