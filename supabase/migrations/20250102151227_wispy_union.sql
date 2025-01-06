-- Step 1: Create policy debugging function
CREATE OR REPLACE FUNCTION log_policy_check(
    policy_name text,
    table_name text,
    operation text,
    result boolean
) RETURNS boolean AS $$
BEGIN
    -- Log policy evaluation
    RAISE NOTICE 'Policy check: table=%, policy=%, operation=%, user=%, result=%',
        table_name,
        policy_name,
        operation,
        auth.uid(),
        result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create helper function to check access
CREATE OR REPLACE FUNCTION check_access(
    p_table text,
    p_id uuid,
    p_operation text DEFAULT 'SELECT'
) RETURNS TABLE (
    has_access boolean,
    reason text
) AS $$
DECLARE
    v_user_id uuid;
    v_result boolean;
    v_reason text;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- Check property access
    IF p_table = 'properties' THEN
        SELECT 
            EXISTS (
                SELECT 1 FROM property_access
                WHERE property_id = p_id
                AND user_id = v_user_id
            ),
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM property_access
                    WHERE property_id = p_id
                    AND user_id = v_user_id
                ) THEN 'Has property access'
                ELSE 'No property access found'
            END
        INTO v_result, v_reason;
        
    -- Check changeover access
    ELSIF p_table = 'changeovers' THEN
        SELECT 
            EXISTS (
                SELECT 1 FROM changeovers c
                WHERE c.id = p_id
                AND (
                    c.share_token IS NOT NULL
                    OR EXISTS (
                        SELECT 1 FROM property_access pa
                        WHERE pa.property_id = c.property_id
                        AND pa.user_id = v_user_id
                    )
                )
            ),
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM changeovers c
                    WHERE c.id = p_id
                    AND c.share_token IS NOT NULL
                ) THEN 'Has share token access'
                WHEN EXISTS (
                    SELECT 1 FROM changeovers c
                    JOIN property_access pa ON pa.property_id = c.property_id
                    WHERE c.id = p_id
                    AND pa.user_id = v_user_id
                ) THEN 'Has property access'
                ELSE 'No access found'
            END
        INTO v_result, v_reason;
        
    -- Check finding access
    ELSIF p_table = 'findings' THEN
        SELECT 
            EXISTS (
                SELECT 1 FROM findings f
                JOIN changeovers c ON c.id = f.changeover_id
                WHERE f.id = p_id
                AND (
                    c.share_token IS NOT NULL
                    OR EXISTS (
                        SELECT 1 FROM property_access pa
                        WHERE pa.property_id = c.property_id
                        AND pa.user_id = v_user_id
                        AND CASE 
                            WHEN p_operation = 'SELECT' THEN true
                            ELSE pa.access_level IN ('write', 'admin')
                        END
                    )
                )
            ),
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM findings f
                    JOIN changeovers c ON c.id = f.changeover_id
                    WHERE f.id = p_id
                    AND c.share_token IS NOT NULL
                ) THEN 'Has share token access'
                WHEN EXISTS (
                    SELECT 1 FROM findings f
                    JOIN changeovers c ON c.id = f.changeover_id
                    JOIN property_access pa ON pa.property_id = c.property_id
                    WHERE f.id = p_id
                    AND pa.user_id = v_user_id
                    AND CASE 
                        WHEN p_operation = 'SELECT' THEN true
                        ELSE pa.access_level IN ('write', 'admin')
                    END
                ) THEN 'Has property access'
                ELSE 'No access found'
            END
        INTO v_result, v_reason;
    END IF;

    -- Log check
    PERFORM log_policy_check(
        'check_access',
        p_table,
        p_operation,
        v_result
    );

    RETURN QUERY SELECT v_result, v_reason;
END;
$$ LANGUAGE plpgsql;