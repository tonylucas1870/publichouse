

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






COMMENT ON SCHEMA "public" IS 'Cleaned up legacy notification triggers and functions.
The notification system now uses the queue_notification function with proper type handling.';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."calendar_sync_status" AS ENUM (
    'pending',
    'synced',
    'failed'
);


ALTER TYPE "public"."calendar_sync_status" OWNER TO "postgres";


CREATE TYPE "public"."changeover_status" AS ENUM (
    'scheduled',
    'in_progress',
    'complete'
);


ALTER TYPE "public"."changeover_status" OWNER TO "postgres";


CREATE TYPE "public"."finding_status" AS ENUM (
    'pending',
    'claimed',
    'disposed'
);


ALTER TYPE "public"."finding_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'changeover_created',
    'changeover_status_changed',
    'finding_created',
    'finding_status_changed',
    'finding_comment_added',
    'finding_media_added'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'not_started',
    'in_progress',
    'complete',
    'blocked'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_uuids_to_content_items"() RETURNS "void"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."add_uuids_to_content_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_access"("p_table" "text", "p_id" "uuid", "p_operation" "text" DEFAULT 'SELECT'::"text") RETURNS TABLE("has_access" boolean, "reason" "text")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_access"("p_table" "text", "p_id" "uuid", "p_operation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_property_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  property_count integer;
  user_limit integer;
BEGIN
  -- Get current property count for user
  SELECT COUNT(*) INTO property_count
  FROM properties
  WHERE created_by = NEW.created_by;

  -- Get user's property limit
  SELECT COALESCE(
    (
      SELECT st.property_limit
      FROM subscriptions s
      JOIN subscription_tiers st ON st.id = s.tier_id
      WHERE s.user_id = NEW.created_by
      AND s.status = 'active'
    ),
    1  -- Free tier limit
  ) INTO user_limit;

  -- Check if adding this property would exceed limit
  IF property_count >= user_limit THEN
    RAISE EXCEPTION 'Property limit reached. Please upgrade your subscription.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_property_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_to_full_account"("p_anonymous_id" "text", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update findings to link to new user
  UPDATE findings
  SET 
    user_id = p_user_id,
    anonymous_user_id = NULL
  WHERE anonymous_user_id = (
    SELECT id FROM anonymous_users WHERE anonymous_id = p_anonymous_id
  );

  -- Delete anonymous user
  DELETE FROM anonymous_users
  WHERE anonymous_id = p_anonymous_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."convert_to_full_account"("p_anonymous_id" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_room_details"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  empty_array jsonb := '[]'::jsonb;
BEGIN
  -- Verify the JSONB array type before insertion
  IF jsonb_typeof(empty_array) != 'array' THEN
    RAISE EXCEPTION 'Invalid JSONB array type';
  END IF;

  -- Insert with explicit JSONB arrays and validation
  INSERT INTO room_details (
    room_id,
    contents,
    walls,
    lighting
  )
  VALUES (
    NEW.id,
    empty_array,
    empty_array,
    empty_array
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_room_details"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_demo_property"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_property_id uuid;
  v_room_id uuid;
  v_changeover_id uuid;
  v_sofa_id uuid;
  v_microwave_id uuid;
  v_bed_id uuid;
  v_mirror_id uuid;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if demo property already exists
  SELECT id INTO v_property_id
  FROM properties
  WHERE name = 'Demo Property'
  AND created_by = auth.uid();

  -- Create demo property if it doesn't exist
  IF v_property_id IS NULL THEN
    -- Create property
    INSERT INTO properties (
      name,
      address,
      created_by
    )
    VALUES (
      'Demo Property',
      '123 Demo Street, Example City',
      auth.uid()
    )
    RETURNING id INTO v_property_id;

    -- Create rooms
    INSERT INTO rooms (name, property_id) VALUES
      ('Living Room', v_property_id),
      ('Kitchen', v_property_id),
      ('Master Bedroom', v_property_id),
      ('Guest Bedroom', v_property_id),
      ('Bathroom', v_property_id);

    -- Generate UUIDs for content items
    v_sofa_id := gen_random_uuid();
    v_microwave_id := gen_random_uuid();
    v_bed_id := gen_random_uuid();
    v_mirror_id := gen_random_uuid();

    -- Add room contents
    FOR v_room_id IN (SELECT id FROM rooms WHERE property_id = v_property_id)
    LOOP
      UPDATE room_details
      SET contents = CASE
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Living Room' THEN
          jsonb_build_array(
            jsonb_build_object(
              'id', v_sofa_id,
              'name', 'Sofa',
              'description', 'Gray 3-seater sofa',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'TV Stand',
              'description', 'Wooden TV stand with storage',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Coffee Table',
              'description', 'Glass top coffee table',
              'images', jsonb_build_array()
            )
          )
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Kitchen' THEN
          jsonb_build_array(
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Refrigerator',
              'description', 'Stainless steel fridge',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Dishwasher',
              'description', 'Built-in dishwasher',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', v_microwave_id,
              'name', 'Microwave',
              'description', 'Countertop microwave',
              'images', jsonb_build_array()
            )
          )
        WHEN (SELECT name FROM rooms WHERE id = v_room_id) = 'Master Bedroom' THEN
          jsonb_build_array(
            jsonb_build_object(
              'id', v_bed_id,
              'name', 'King Size Bed',
              'description', 'Luxury king size bed with upholstered headboard',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', v_mirror_id,
              'name', 'Mirror',
              'description', 'Standing mirror with wooden frame',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Dresser',
              'description', '6-drawer dresser',
              'images', jsonb_build_array()
            ),
            jsonb_build_object(
              'id', gen_random_uuid(),
              'name', 'Nightstands',
              'description', 'Pair of matching nightstands',
              'images', jsonb_build_array()
            )
          )
        ELSE
          jsonb_build_array()
      END
      WHERE room_id = v_room_id;
    END LOOP;

    -- Create changeover
    INSERT INTO changeovers (
      property_id,
      checkin_date,
      checkout_date,
      status,
      created_by
    )
    VALUES (
      v_property_id,
      current_date + interval '1 day',
      current_date + interval '8 days',
      'scheduled',
      auth.uid()
    )
    RETURNING id INTO v_changeover_id;

    -- Create findings
    INSERT INTO findings (
      description,
      location,
      changeover_id,
      status,
      user_id,
      content_item,
      notes
    )
    VALUES
      (
        'Stain on sofa cushion',
        'Living Room',
        v_changeover_id,
        'open',
        auth.uid(),
        jsonb_build_object(
          'id', v_sofa_id,
          'name', 'Sofa',
          'description', 'Gray 3-seater sofa'
        ),
        jsonb_build_array(
          jsonb_build_object(
            'text', 'Will need professional cleaning',
            'created_at', now(),
            'author', jsonb_build_object(
              'type', 'authenticated',
              'id', auth.uid(),
              'display_name', 'You'
            )
          )
        )
      ),
      (
        'Microwave not heating properly',
        'Kitchen',
        v_changeover_id,
        'blocked',
        auth.uid(),
        jsonb_build_object(
          'id', v_microwave_id,
          'name', 'Microwave',
          'description', 'Countertop microwave'
        ),
        jsonb_build_array(
          jsonb_build_object(
            'text', 'Waiting for repair service availability',
            'created_at', now(),
            'author', jsonb_build_object(
              'type', 'authenticated',
              'id', auth.uid(),
              'display_name', 'You'
            )
          )
        )
      ),
      (
        'Loose headboard on bed',
        'Master Bedroom',
        v_changeover_id,
        'open',
        auth.uid(),
        jsonb_build_object(
          'id', v_bed_id,
          'name', 'King Size Bed',
          'description', 'Luxury king size bed with upholstered headboard'
        ),
        jsonb_build_array(
          jsonb_build_object(
            'text', 'Needs tightening of all mounting screws',
            'created_at', now(),
            'author', jsonb_build_object(
              'type', 'authenticated',
              'id', auth.uid(),
              'display_name', 'You'
            )
          )
        )
      );

    -- Create tasks
    INSERT INTO property_tasks (
      property_id,
      title,
      description,
      location,
      created_by,
      scheduling_type,
      interval
    )
    VALUES
      (
        v_property_id,
        'Deep clean carpets',
        'Professional carpet cleaning service',
        'Living Room',
        auth.uid(),
        'month',
        3
      ),
      (
        v_property_id,
        'Check appliances',
        'Test all kitchen appliances for proper operation',
        'Kitchen',
        auth.uid(),
        'changeover',
        1
      ),
      (
        v_property_id,
        'Inspect bed frame',
        'Check all bed frame connections and tighten if needed',
        'Master Bedroom',
        auth.uid(),
        'changeover',
        2
      );
  END IF;

  RETURN v_property_id;
END;
$$;


ALTER FUNCTION "public"."create_demo_property"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_finding_share_link"("finding_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_share_token text;
BEGIN
  -- Get or create share token
  UPDATE findings
  SET share_token = COALESCE(share_token, encode(gen_random_bytes(32), 'hex'))
  WHERE id = finding_id
  RETURNING share_token INTO v_share_token;

  RETURN v_share_token;
END;
$$;


ALTER FUNCTION "public"."create_finding_share_link"("finding_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_findings_from_tasks"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only proceed if status is changing to in_progress
  IF NEW.status = 'in_progress' AND OLD.status = 'scheduled' THEN
    -- Create findings for each applicable task
    INSERT INTO findings (
      description,
      location,
      changeover_id,
      status,
      user_id,
      content_item,
      images
    )
    SELECT
      pt.title,
      pt.location,
      NEW.id,
      'pending',
      NEW.created_by,
      NULL,
      pt.images  -- Copy images from task to finding
    FROM property_tasks pt
    WHERE pt.property_id = NEW.property_id
    AND should_include_task(pt.id, NEW.id);

    -- Record task executions
    INSERT INTO task_executions (
      task_id,
      changeover_id,
      created_by
    )
    SELECT
      pt.id,
      NEW.id,
      NEW.created_by
    FROM property_tasks pt
    WHERE pt.property_id = NEW.property_id
    AND should_include_task(pt.id, NEW.id);

    -- Update last_executed timestamp
    UPDATE property_tasks pt
    SET last_executed = now()
    WHERE pt.property_id = NEW.property_id
    AND should_include_task(pt.id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_findings_from_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."disable_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  ALTER TABLE changeovers DISABLE TRIGGER notify_changeover_created;
  ALTER TABLE changeovers DISABLE TRIGGER notify_changeover_status_changed;
  ALTER TABLE findings DISABLE TRIGGER notify_finding_created;
  ALTER TABLE findings DISABLE TRIGGER notify_finding_status_changed;
  ALTER TABLE findings DISABLE TRIGGER notify_finding_updated;
END;
$$;


ALTER FUNCTION "public"."disable_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enable_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  ALTER TABLE changeovers ENABLE TRIGGER notify_changeover_created;
  ALTER TABLE changeovers ENABLE TRIGGER notify_changeover_status_changed;
  ALTER TABLE findings ENABLE TRIGGER notify_finding_created;
  ALTER TABLE findings ENABLE TRIGGER notify_finding_status_changed;
  ALTER TABLE findings ENABLE TRIGGER notify_finding_updated;
END;
$$;


ALTER FUNCTION "public"."enable_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_finding_share_token"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only generate token if one doesn't exist
  IF NEW.share_token IS NULL THEN
    NEW.share_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_finding_share_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_anonymous_user"("p_anonymous_id" "text", "p_name" "text", "p_changeover_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "anonymous_id" "text", "changeover_ids" "uuid"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user anonymous_users%ROWTYPE;
  v_changeover_ids uuid[];
BEGIN
  -- First try to get existing user
  SELECT * INTO v_user
  FROM anonymous_users au
  WHERE au.anonymous_id = p_anonymous_id;

  IF v_user.id IS NULL THEN
    -- Create new user
    INSERT INTO anonymous_users (name, anonymous_id, changeover_ids)
    VALUES (p_name, p_anonymous_id, ARRAY[p_changeover_id])
    RETURNING * INTO v_user;
  ELSE
    -- Update last seen and add changeover if not already present
    UPDATE anonymous_users au
    SET 
      last_seen = now(),
      changeover_ids = array_append(
        array_remove(au.changeover_ids, p_changeover_id),
        p_changeover_id
      )
    WHERE au.id = v_user.id
    RETURNING * INTO v_user;
  END IF;

  -- Return result
  RETURN QUERY
  SELECT 
    v_user.id,
    v_user.name,
    v_user.anonymous_id,
    v_user.changeover_ids;
END;
$$;


ALTER FUNCTION "public"."get_or_create_anonymous_user"("p_anonymous_id" "text", "p_name" "text", "p_changeover_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_start" timestamp with time zone NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'past_due'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_subscription_update"("p_user_id" "uuid", "p_tier_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_status" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean) RETURNS "public"."subscriptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  existing_sub subscriptions%ROWTYPE;
  result subscriptions%ROWTYPE;
BEGIN
  -- Check for existing subscription
  SELECT * INTO existing_sub
  FROM subscriptions
  WHERE user_id = p_user_id;

  IF existing_sub.id IS NOT NULL THEN
    -- Archive existing subscription
    INSERT INTO subscription_history (
      subscription_id,
      tier_id,
      status,
      period_start,
      period_end
    ) VALUES (
      existing_sub.id,
      existing_sub.tier_id,
      existing_sub.status,
      existing_sub.current_period_start,
      existing_sub.current_period_end
    );

    -- Update existing subscription
    UPDATE subscriptions SET
      tier_id = p_tier_id,
      stripe_customer_id = p_stripe_customer_id,
      stripe_subscription_id = p_stripe_subscription_id,
      status = p_status,
      current_period_start = p_period_start,
      current_period_end = p_period_end,
      cancel_at_period_end = p_cancel_at_period_end,
      updated_at = now()
    WHERE id = existing_sub.id
    RETURNING * INTO result;
  ELSE
    -- Create new subscription
    INSERT INTO subscriptions (
      user_id,
      tier_id,
      stripe_customer_id,
      stripe_subscription_id,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end
    ) VALUES (
      p_user_id,
      p_tier_id,
      p_stripe_customer_id,
      p_stripe_subscription_id,
      p_status,
      p_period_start,
      p_period_end,
      p_cancel_at_period_end
    )
    RETURNING * INTO result;
  END IF;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."handle_subscription_update"("p_user_id" "uuid", "p_tier_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_status" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_policy_check"("policy_name" "text", "table_name" "text", "operation" "text", "result" boolean) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."log_policy_check"("policy_name" "text", "table_name" "text", "operation" "text", "result" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_changeover_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_property_owner uuid;
  v_property_name text;
  v_initial_sync_complete boolean;
BEGIN
  BEGIN
    -- Get property owner, name and sync status
    SELECT 
      created_by,
      name,
      initial_sync_complete INTO v_property_owner, v_property_name, v_initial_sync_complete
    FROM properties
    WHERE id = NEW.property_id;

    -- Only send notification if initial sync is complete
    IF v_property_owner IS NOT NULL AND v_initial_sync_complete THEN
      PERFORM queue_notification(
        v_property_owner,
        'changeover_created'::notification_type,
        jsonb_build_object(
          'property_name', v_property_name,
          'checkin_date', NEW.checkin_date,
          'checkout_date', NEW.checkout_date,
          'property_owner_id', v_property_owner
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send changeover created notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_changeover_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_changeover_status_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_property_owner uuid;
  v_property_name text;
BEGIN
  IF OLD.status <> NEW.status THEN
    BEGIN
      -- Get property owner and name
      SELECT created_by, name INTO v_property_owner, v_property_name
      FROM properties
      WHERE id = NEW.property_id;

      -- Queue notification for property owner
      IF v_property_owner IS NOT NULL THEN
        PERFORM queue_notification(
          v_property_owner,
          'changeover_status_changed'::notification_type,
          jsonb_build_object(
            'property_name', v_property_name,
            'checkin_date', NEW.checkin_date,
            'checkout_date', NEW.checkout_date,
            'status', NEW.status,
            'property_owner_id', v_property_owner
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the trigger
      RAISE WARNING 'Failed to send changeover status notification: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_changeover_status_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_finding_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_property_name text;
  v_property_owner uuid;
BEGIN
  BEGIN
    -- Get property details through changeover
    SELECT p.name, p.created_by INTO v_property_name, v_property_owner
    FROM properties p
    JOIN changeovers c ON c.property_id = p.id
    WHERE c.id = NEW.changeover_id;

    -- Queue notification for property owner
    IF v_property_owner IS NOT NULL THEN
      PERFORM queue_notification(
        v_property_owner,
        'finding_created'::notification_type,
        jsonb_build_object(
          'property_name', v_property_name,
          'location', NEW.location,
          'description', NEW.description,
          'property_owner_id', v_property_owner
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Failed to send finding created notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_finding_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_finding_status_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_property_name text;
  v_property_owner uuid;
BEGIN
  IF OLD.status <> NEW.status THEN
    BEGIN
      -- Get property details through changeover
      SELECT p.name, p.created_by INTO v_property_name, v_property_owner
      FROM properties p
      JOIN changeovers c ON c.property_id = p.id
      WHERE c.id = NEW.changeover_id;

      -- Queue notification for property owner
      IF v_property_owner IS NOT NULL THEN
        PERFORM queue_notification(
          v_property_owner,
          'finding_status_changed'::notification_type,
          jsonb_build_object(
            'property_name', v_property_name,
            'location', NEW.location,
            'description', NEW.description,
            'status', NEW.status,
            'property_owner_id', v_property_owner
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the trigger
      RAISE WARNING 'Failed to send finding status notification: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_finding_status_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_finding_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_property_name text;
  v_property_owner uuid;
  v_old_notes jsonb;
  v_new_notes jsonb;
  v_old_images jsonb;
  v_new_images jsonb;
BEGIN
  BEGIN
    -- Get property details through changeover
    SELECT p.name, p.created_by INTO v_property_name, v_property_owner
    FROM properties p
    JOIN changeovers c ON c.property_id = p.id
    WHERE c.id = NEW.changeover_id;

    IF v_property_owner IS NOT NULL THEN
      -- Check for new notes
      v_old_notes := COALESCE(OLD.notes, '[]'::jsonb);
      v_new_notes := COALESCE(NEW.notes, '[]'::jsonb);
      
      IF jsonb_array_length(v_new_notes) > jsonb_array_length(v_old_notes) THEN
        -- Queue notification for property owner
        PERFORM queue_notification(
          v_property_owner,
          'finding_comment_added'::notification_type,
          jsonb_build_object(
            'property_name', v_property_name,
            'location', NEW.location,
            'description', NEW.description,
            'comment', v_new_notes->-1->>'text',
            'property_owner_id', v_property_owner
          )
        );
      END IF;

      -- Check for new images
      v_old_images := COALESCE(OLD.images, '[]'::jsonb);
      v_new_images := COALESCE(NEW.images, '[]'::jsonb);
      
      IF jsonb_array_length(v_new_images) > jsonb_array_length(v_old_images) THEN
        -- Queue notification for property owner
        PERFORM queue_notification(
          v_property_owner,
          'finding_media_added'::notification_type,
          jsonb_build_object(
            'property_name', v_property_name,
            'location', NEW.location,
            'description', NEW.description,
            'property_owner_id', v_property_owner
          )
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Failed to send finding update notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_finding_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_type" "public"."notification_type", "p_data" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_template notification_templates;
  v_enabled boolean;
  v_notification_id uuid;
BEGIN
  -- Check if user wants this notification
  SELECT enabled INTO v_enabled
  FROM notification_preferences
  WHERE user_id = p_user_id
  AND notification_type = p_type;

  IF v_enabled IS NULL OR v_enabled THEN
    -- Get template
    SELECT * INTO v_template
    FROM notification_templates
    WHERE notification_type = p_type;

    IF v_template IS NULL THEN
      RAISE EXCEPTION 'No template found for notification type %', p_type;
    END IF;

    -- Queue notification
    INSERT INTO notification_queue
      (user_id, notification_type, subject, body, data)
    VALUES
      (p_user_id, p_type, v_template.subject_template, v_template.body_template, p_data)
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_type" "public"."notification_type", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Cast the text type to notification_type and forward to queue_notification
  RETURN queue_notification(
    p_user_id,
    p_type::notification_type,
    p_data
  );
END;
$$;


ALTER FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb") IS 'Wrapper function that forwards to queue_notification with proper type casting. 
Maintains backward compatibility with any existing code still using send_notification.';



CREATE OR REPLACE FUNCTION "public"."set_finding_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Set user_id to authenticated user
  NEW.user_id = auth.uid();
  
  -- For shared changeovers, get property owner
  IF NEW.user_id IS NULL THEN
    SELECT p.created_by INTO NEW.user_id
    FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = NEW.changeover_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_finding_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."should_include_task"("p_task_id" "uuid", "p_changeover_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_task property_tasks;
  v_last_execution task_executions;
  v_changeover_count int;
  v_months_since_last numeric;
BEGIN
  -- Get task
  SELECT * INTO v_task
  FROM property_tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If no scheduling type, always include the task
  IF v_task.scheduling_type IS NULL THEN
    RETURN true;
  END IF;

  -- Get last successful execution
  SELECT * INTO v_last_execution
  FROM task_executions
  WHERE task_id = p_task_id
  AND status = 'success'
  ORDER BY executed_at DESC
  LIMIT 1;

  -- Check based on scheduling type
  CASE v_task.scheduling_type
    WHEN 'changeover' THEN
      -- Count changeovers since last execution
      SELECT COUNT(*) INTO v_changeover_count
      FROM changeovers c
      WHERE c.property_id = v_task.property_id
      AND c.status = 'complete'
      AND (
        v_last_execution IS NULL OR
        c.completed_at > v_last_execution.executed_at
      );

      IF v_changeover_count < v_task.interval THEN
        RETURN false;
      END IF;

    WHEN 'month' THEN
      IF v_last_execution IS NOT NULL THEN
        -- Calculate months since last execution
        v_months_since_last := EXTRACT(EPOCH FROM (now() - v_last_execution.executed_at)) / (30 * 24 * 60 * 60);
        
        IF v_months_since_last < v_task.interval::numeric THEN
          RETURN false;
        END IF;
      END IF;
  END CASE;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."should_include_task"("p_task_id" "uuid", "p_changeover_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."changeovers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "checkout_date" "date" NOT NULL,
    "checkin_date" "date" NOT NULL,
    "share_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text"),
    "status" "text" DEFAULT '''scheduled''::text'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "calendar_booking_id" "text"
);


ALTER TABLE "public"."changeovers" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_changeover_status"("changeover_id_input" "uuid", "new_status" "text") RETURNS "public"."changeovers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  result changeovers;
BEGIN
  -- Check if user has permission
  IF NOT EXISTS (
    SELECT 1 FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = changeover_id_input
    AND p.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update changeover status';
  END IF;

  -- Validate status
  IF new_status NOT IN ('scheduled', 'in_progress', 'complete') THEN
    RAISE EXCEPTION 'Invalid status. Must be scheduled, in_progress, or complete';
  END IF;

  -- Update status
  UPDATE changeovers
  SET status = new_status::changeover_status
  WHERE id = changeover_id_input
  RETURNING * INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."update_changeover_status"("changeover_id_input" "uuid", "new_status" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."changeover_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "changeover_id" "uuid",
    "task_id" "uuid",
    "status" "public"."task_status" DEFAULT 'not_started'::"public"."task_status" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."changeover_tasks" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_changeover_task_status"("changeover_id_input" "uuid", "task_id_input" "uuid", "new_status" "public"."task_status") RETURNS "public"."changeover_tasks"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  result changeover_tasks;
BEGIN
  -- Check if user has permission
  IF NOT EXISTS (
    SELECT 1 FROM changeovers c
    JOIN properties p ON p.id = c.property_id
    WHERE c.id = changeover_id_input
    AND p.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update task status';
  END IF;

  -- Update status
  UPDATE changeover_tasks
  SET 
    status = new_status,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE changeover_id = changeover_id_input
  AND task_id = task_id_input
  RETURNING * INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."update_changeover_task_status"("changeover_id_input" "uuid", "task_id_input" "uuid", "new_status" "public"."task_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_properties_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_properties_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_room_details_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_room_details_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_content_items"("contents" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $_$
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
$_$;


ALTER FUNCTION "public"."validate_content_items"("contents" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_content_items_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.contents IS NOT NULL THEN
    PERFORM validate_content_items(NEW.contents);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_content_items_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_scheduling_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Validate changeover_interval
  IF (NEW.scheduling_rules->>'changeover_interval') IS NOT NULL THEN
    IF NOT (NEW.scheduling_rules->>'changeover_interval')::int > 0 THEN
      RAISE EXCEPTION 'Changeover interval must be greater than 0';
    END IF;
  END IF;

  -- Validate month_interval
  IF (NEW.scheduling_rules->>'month_interval') IS NOT NULL THEN
    IF NOT (NEW.scheduling_rules->>'month_interval')::int > 0 THEN
      RAISE EXCEPTION 'Month interval must be greater than 0';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_scheduling_rules"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "description" "text" NOT NULL,
    "location" "text" NOT NULL,
    "date_found" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changeover_id" "uuid",
    "notes" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "content_item" "jsonb",
    "anonymous_user_id" "uuid",
    "share_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text"),
    CONSTRAINT "findings_images_is_array" CHECK (("jsonb_typeof"("images") = 'array'::"text")),
    CONSTRAINT "findings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'open'::"text", 'blocked'::"text", 'wont_fix'::"text", 'fixed'::"text"])))
);


ALTER TABLE "public"."findings" OWNER TO "postgres";


COMMENT ON TABLE "public"."findings" IS 'Findings can be accessed anonymously via share tokens (either direct finding share token
or through a changeover share token). However, notes can only be added when accessing
through a changeover share token. Property owners have full access to their findings.';



COMMENT ON COLUMN "public"."findings"."status" IS 'Finding status:
 - pending: Initial state before review
 - open: Needs attention/review
 - blocked: Cannot be fixed due to external factors
 - wont_fix: Deliberately decided not to fix
 - fixed: Issue has been resolved';



CREATE OR REPLACE FUNCTION "public"."verify_finding_notes_only"("finding_record" "public"."findings", "new_notes" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Return true if only notes are different
  RETURN (
    finding_record.description = finding_record.description
    AND finding_record.location = finding_record.location
    AND finding_record.date_found = finding_record.date_found
    AND finding_record.status = finding_record.status
    AND finding_record.images = finding_record.images
    AND finding_record.content_item = finding_record.content_item
    AND finding_record.changeover_id = finding_record.changeover_id
    AND finding_record.share_token = finding_record.share_token
    AND finding_record.notes IS DISTINCT FROM new_notes
  );
END;
$$;


ALTER FUNCTION "public"."verify_finding_notes_only"("finding_record" "public"."findings", "new_notes" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anonymous_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "anonymous_id" "text" NOT NULL,
    "changeover_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_seen" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."anonymous_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ical_feed_access" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "token" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ical_feed_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "notification_type" "public"."notification_type" NOT NULL,
    "enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "notification_type" "public"."notification_type" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "attempts" integer DEFAULT 0,
    "last_attempt" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."notification_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_type" "public"."notification_type" NOT NULL,
    "subject_template" "text" NOT NULL,
    "body_template" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "calendar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "calendar_sync_status" "public"."calendar_sync_status" DEFAULT 'pending'::"public"."calendar_sync_status",
    "calendar_last_synced" timestamp with time zone,
    "calendar_sync_error" "text",
    "initial_sync_complete" boolean DEFAULT false
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "location" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "scheduling_rules" "jsonb" DEFAULT '{}'::"jsonb",
    "last_executed" timestamp with time zone,
    "scheduling_type" "text",
    "interval" integer,
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "property_tasks_interval_check" CHECK (("interval" > 0)),
    CONSTRAINT "property_tasks_scheduling_type_check" CHECK (("scheduling_type" = ANY (ARRAY['changeover'::"text", 'month'::"text"]))),
    CONSTRAINT "task_images_is_array" CHECK (("jsonb_typeof"("images") = 'array'::"text"))
);


ALTER TABLE "public"."property_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "contents" "jsonb" DEFAULT '[]'::"jsonb",
    "walls" "jsonb" DEFAULT '[]'::"jsonb",
    "lighting" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contents_is_array" CHECK (("jsonb_typeof"("contents") = 'array'::"text")),
    CONSTRAINT "lighting_is_array" CHECK (("jsonb_typeof"("lighting") = 'array'::"text")),
    CONSTRAINT "walls_is_array" CHECK (("jsonb_typeof"("walls") = 'array'::"text"))
);


ALTER TABLE "public"."room_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "property_limit" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscription_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "changeover_id" "uuid",
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "status" "text" DEFAULT 'success'::"text",
    "notes" "text",
    CONSTRAINT "task_executions_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failure'::"text"])))
);


ALTER TABLE "public"."task_executions" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_executions" IS 'Tracks when tasks are executed as part of changeovers, including success/failure status and any notes.
Tasks without scheduling rules run every time by default.';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "display_name" "text",
    "notification_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."utilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "account_number" "text",
    "notes" "text",
    "property_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."utilities" OWNER TO "postgres";


ALTER TABLE ONLY "public"."anonymous_users"
    ADD CONSTRAINT "anonymous_users_anonymous_id_key" UNIQUE ("anonymous_id");



ALTER TABLE ONLY "public"."anonymous_users"
    ADD CONSTRAINT "anonymous_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changeover_tasks"
    ADD CONSTRAINT "changeover_tasks_changeover_id_task_id_key" UNIQUE ("changeover_id", "task_id");



ALTER TABLE ONLY "public"."changeover_tasks"
    ADD CONSTRAINT "changeover_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changeovers"
    ADD CONSTRAINT "changeovers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changeovers"
    ADD CONSTRAINT "changeovers_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."findings"
    ADD CONSTRAINT "findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ical_feed_access"
    ADD CONSTRAINT "ical_feed_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ical_feed_access"
    ADD CONSTRAINT "ical_feed_access_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_notification_type_key" UNIQUE ("user_id", "notification_type");



ALTER TABLE ONLY "public"."notification_queue"
    ADD CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_notification_type_key" UNIQUE ("notification_type");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_tasks"
    ADD CONSTRAINT "property_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_tasks"
    ADD CONSTRAINT "property_tasks_property_id_title_key" UNIQUE ("property_id", "title");



ALTER TABLE ONLY "public"."room_details"
    ADD CONSTRAINT "room_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_details"
    ADD CONSTRAINT "room_details_room_id_key" UNIQUE ("room_id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_property_id_name_key" UNIQUE ("property_id", "name");



ALTER TABLE ONLY "public"."subscription_history"
    ADD CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tiers"
    ADD CONSTRAINT "subscription_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."task_executions"
    ADD CONSTRAINT "task_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_executions"
    ADD CONSTRAINT "task_executions_task_id_changeover_id_key" UNIQUE ("task_id", "changeover_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_property_id_title_key" UNIQUE ("property_id", "title");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."utilities"
    ADD CONSTRAINT "utilities_pkey" PRIMARY KEY ("id");



CREATE INDEX "changeovers_calendar_booking_idx" ON "public"."changeovers" USING "btree" ("calendar_booking_id");



CREATE INDEX "changeovers_property_id_idx" ON "public"."changeovers" USING "btree" ("property_id");



CREATE INDEX "changeovers_share_token_idx" ON "public"."changeovers" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "findings_changeover_id_idx" ON "public"."findings" USING "btree" ("changeover_id");



CREATE INDEX "findings_notes_idx" ON "public"."findings" USING "gin" ("notes");



CREATE INDEX "findings_status_changeover_idx" ON "public"."findings" USING "btree" ("status", "changeover_id");



CREATE INDEX "findings_status_idx" ON "public"."findings" USING "btree" ("status");



CREATE INDEX "ical_feed_access_token_idx" ON "public"."ical_feed_access" USING "btree" ("token");



CREATE INDEX "ical_feed_access_user_id_idx" ON "public"."ical_feed_access" USING "btree" ("user_id");



CREATE INDEX "idx_changeover_tasks_changeover_id" ON "public"."changeover_tasks" USING "btree" ("changeover_id");



CREATE INDEX "idx_changeover_tasks_status" ON "public"."changeover_tasks" USING "btree" ("status");



CREATE INDEX "idx_changeover_tasks_task_id" ON "public"."changeover_tasks" USING "btree" ("task_id");



CREATE INDEX "idx_changeovers_property_id" ON "public"."changeovers" USING "btree" ("property_id");



CREATE INDEX "idx_changeovers_property_lookup" ON "public"."changeovers" USING "btree" ("property_id", "share_token");



CREATE INDEX "idx_changeovers_share_token" ON "public"."changeovers" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "idx_findings_changeover_id" ON "public"."findings" USING "btree" ("changeover_id");



CREATE INDEX "idx_findings_content_item" ON "public"."findings" USING "gin" ("content_item");



CREATE INDEX "idx_findings_share_token" ON "public"."findings" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "idx_findings_status" ON "public"."findings" USING "btree" ("status");



CREATE INDEX "idx_properties_created_by" ON "public"."properties" USING "btree" ("created_by");



CREATE INDEX "idx_subscription_history_subscription_id" ON "public"."subscription_history" USING "btree" ("subscription_id");



CREATE INDEX "idx_subscriptions_customer_id" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_stripe_id" ON "public"."subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_subscriptions_tier_id" ON "public"."subscriptions" USING "btree" ("tier_id");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_task_executions_changeover_id" ON "public"."task_executions" USING "btree" ("changeover_id");



CREATE INDEX "idx_task_executions_executed_at" ON "public"."task_executions" USING "btree" ("executed_at");



CREATE INDEX "idx_task_executions_task_id" ON "public"."task_executions" USING "btree" ("task_id");



CREATE INDEX "idx_tasks_property_id" ON "public"."tasks" USING "btree" ("property_id");



CREATE INDEX "properties_created_by_idx" ON "public"."properties" USING "btree" ("created_by");



CREATE OR REPLACE TRIGGER "check_property_limit_trigger" BEFORE INSERT ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."check_property_limit"();



CREATE OR REPLACE TRIGGER "create_findings_from_tasks_trigger" AFTER UPDATE OF "status" ON "public"."changeovers" FOR EACH ROW EXECUTE FUNCTION "public"."create_findings_from_tasks"();



CREATE OR REPLACE TRIGGER "create_room_details_trigger" AFTER INSERT ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_room_details"();



CREATE OR REPLACE TRIGGER "generate_finding_share_token_trigger" BEFORE INSERT ON "public"."findings" FOR EACH ROW EXECUTE FUNCTION "public"."generate_finding_share_token"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."ical_feed_access" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "notify_changeover_created" AFTER INSERT ON "public"."changeovers" FOR EACH ROW EXECUTE FUNCTION "public"."notify_changeover_created"();



CREATE OR REPLACE TRIGGER "notify_changeover_status_changed" AFTER UPDATE OF "status" ON "public"."changeovers" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."notify_changeover_status_changed"();



CREATE OR REPLACE TRIGGER "notify_finding_created" AFTER INSERT ON "public"."findings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_finding_created"();



CREATE OR REPLACE TRIGGER "notify_finding_status_changed" AFTER UPDATE OF "status" ON "public"."findings" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."notify_finding_status_changed"();



CREATE OR REPLACE TRIGGER "notify_finding_updated" AFTER UPDATE ON "public"."findings" FOR EACH ROW WHEN ((("old"."notes" IS DISTINCT FROM "new"."notes") OR ("old"."images" IS DISTINCT FROM "new"."images"))) EXECUTE FUNCTION "public"."notify_finding_updated"();



CREATE OR REPLACE TRIGGER "set_finding_user_id_trigger" BEFORE INSERT ON "public"."findings" FOR EACH ROW EXECUTE FUNCTION "public"."set_finding_user_id"();



CREATE OR REPLACE TRIGGER "update_properties_timestamp" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."update_properties_updated_at"();



CREATE OR REPLACE TRIGGER "update_room_details_timestamp" BEFORE UPDATE ON "public"."room_details" FOR EACH ROW EXECUTE FUNCTION "public"."update_room_details_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_settings_timestamp" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_settings_updated_at"();



CREATE OR REPLACE TRIGGER "validate_content_items_trigger" BEFORE INSERT OR UPDATE ON "public"."room_details" FOR EACH ROW EXECUTE FUNCTION "public"."validate_content_items_trigger"();



CREATE OR REPLACE TRIGGER "validate_scheduling_rules_trigger" BEFORE INSERT OR UPDATE ON "public"."property_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."validate_scheduling_rules"();



ALTER TABLE ONLY "public"."changeover_tasks"
    ADD CONSTRAINT "changeover_tasks_changeover_id_fkey" FOREIGN KEY ("changeover_id") REFERENCES "public"."changeovers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."changeover_tasks"
    ADD CONSTRAINT "changeover_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."changeover_tasks"
    ADD CONSTRAINT "changeover_tasks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."changeovers"
    ADD CONSTRAINT "changeovers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."changeovers"
    ADD CONSTRAINT "changeovers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."findings"
    ADD CONSTRAINT "findings_anonymous_user_id_fkey" FOREIGN KEY ("anonymous_user_id") REFERENCES "public"."anonymous_users"("id");



ALTER TABLE ONLY "public"."findings"
    ADD CONSTRAINT "findings_changeover_id_fkey" FOREIGN KEY ("changeover_id") REFERENCES "public"."changeovers"("id");



ALTER TABLE ONLY "public"."findings"
    ADD CONSTRAINT "findings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ical_feed_access"
    ADD CONSTRAINT "ical_feed_access_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ical_feed_access"
    ADD CONSTRAINT "ical_feed_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_queue"
    ADD CONSTRAINT "notification_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."property_tasks"
    ADD CONSTRAINT "property_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."property_tasks"
    ADD CONSTRAINT "property_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_details"
    ADD CONSTRAINT "room_details_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."subscription_history"
    ADD CONSTRAINT "subscription_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_history"
    ADD CONSTRAINT "subscription_history_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."subscription_tiers"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_executions"
    ADD CONSTRAINT "task_executions_changeover_id_fkey" FOREIGN KEY ("changeover_id") REFERENCES "public"."changeovers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_executions"
    ADD CONSTRAINT "task_executions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."task_executions"
    ADD CONSTRAINT "task_executions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."property_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utilities"
    ADD CONSTRAINT "utilities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



CREATE POLICY "Anonymous users can view own profile" ON "public"."anonymous_users" FOR SELECT USING (("anonymous_id" = "current_setting"('app.anonymous_id'::"text", true)));



CREATE POLICY "Anyone can view properties through shared changeovers" ON "public"."properties" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."property_id" = "properties"."id") AND ("c"."share_token" IS NOT NULL)))));



CREATE POLICY "Anyone can view rooms for shared changeovers" ON "public"."rooms" FOR SELECT USING (("property_id" IN ( SELECT "changeovers"."property_id"
   FROM "public"."changeovers"
  WHERE ("changeovers"."share_token" IS NOT NULL))));



CREATE POLICY "Anyone with share token can view changeover" ON "public"."changeovers" FOR SELECT USING (("share_token" IS NOT NULL));



CREATE POLICY "Anyone with share token can view finding" ON "public"."findings" FOR SELECT USING (("share_token" IS NOT NULL));



CREATE POLICY "Authenticated users can create findings" ON "public"."findings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Public can view subscription tiers" ON "public"."subscription_tiers" FOR SELECT USING (true);



CREATE POLICY "Service role can manage anonymous users" ON "public"."anonymous_users" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage notification queue" ON "public"."notification_queue" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage templates" ON "public"."notification_templates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can create changeovers" ON "public"."changeovers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create properties" ON "public"."properties" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can create rooms for their properties" ON "public"."rooms" FOR INSERT TO "authenticated" WITH CHECK (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can create their own feed tokens" ON "public"."ical_feed_access" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create utilities for their properties" ON "public"."utilities" FOR INSERT TO "authenticated" WITH CHECK (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can delete rooms for their properties" ON "public"."rooms" FOR DELETE TO "authenticated" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can delete utilities for their properties" ON "public"."utilities" FOR DELETE TO "authenticated" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can insert own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert room details for their properties" ON "public"."room_details" FOR INSERT TO "authenticated" WITH CHECK (("room_id" IN ( SELECT "r"."id"
   FROM ("public"."rooms" "r"
     JOIN "public"."properties" "p" ON (("r"."property_id" = "p"."id")))
  WHERE ("p"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can manage tasks for their properties" ON "public"."property_tasks" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"())))) WITH CHECK (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can manage their notification preferences" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update calendar sync status" ON "public"."properties" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can update own settings" ON "public"."user_settings" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update room details for their properties" ON "public"."room_details" FOR UPDATE TO "authenticated" USING (("room_id" IN ( SELECT "r"."id"
   FROM ("public"."rooms" "r"
     JOIN "public"."properties" "p" ON (("r"."property_id" = "p"."id")))
  WHERE ("p"."created_by" = "auth"."uid"())))) WITH CHECK (("room_id" IN ( SELECT "r"."id"
   FROM ("public"."rooms" "r"
     JOIN "public"."properties" "p" ON (("r"."property_id" = "p"."id")))
  WHERE ("p"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can update their own findings" ON "public"."findings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own properties" ON "public"."properties" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can update utilities for their properties" ON "public"."utilities" FOR UPDATE TO "authenticated" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"())))) WITH CHECK (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can view own settings" ON "public"."user_settings" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own subscription history" ON "public"."subscription_history" FOR SELECT TO "authenticated" USING (("subscription_id" IN ( SELECT "subscriptions"."id"
   FROM "public"."subscriptions"
  WHERE ("subscriptions"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view room details for their properties" ON "public"."room_details" FOR SELECT TO "authenticated" USING (("room_id" IN ( SELECT "r"."id"
   FROM ("public"."rooms" "r"
     JOIN "public"."properties" "p" ON (("r"."property_id" = "p"."id")))
  WHERE ("p"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can view rooms for their properties" ON "public"."rooms" FOR SELECT TO "authenticated" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can view task executions for their properties" ON "public"."task_executions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."property_tasks" "pt"
     JOIN "public"."properties" "p" ON (("p"."id" = "pt"."property_id")))
  WHERE (("pt"."id" = "task_executions"."task_id") AND ("p"."created_by" = "auth"."uid"())))));



CREATE POLICY "Users can view their notifications" ON "public"."notification_queue" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own feed tokens" ON "public"."ical_feed_access" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view utilities for their properties" ON "public"."utilities" FOR SELECT TO "authenticated" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



ALTER TABLE "public"."anonymous_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "changeover_access" ON "public"."changeovers" FOR SELECT USING ((("share_token" IS NOT NULL) OR ("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"())))));



CREATE POLICY "changeover_task_access" ON "public"."changeover_tasks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."changeovers" "c"
     JOIN "public"."properties" "p" ON (("p"."id" = "c"."property_id")))
  WHERE (("c"."id" = "changeover_tasks"."changeover_id") AND (("c"."share_token" IS NOT NULL) OR ("p"."created_by" = "auth"."uid"()))))));



CREATE POLICY "changeover_task_write" ON "public"."changeover_tasks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."changeovers" "c"
     JOIN "public"."properties" "p" ON (("p"."id" = "c"."property_id")))
  WHERE (("c"."id" = "changeover_tasks"."changeover_id") AND ("p"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."changeovers" "c"
     JOIN "public"."properties" "p" ON (("p"."id" = "c"."property_id")))
  WHERE (("c"."id" = "changeover_tasks"."changeover_id") AND ("p"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."changeover_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."changeovers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finding_insert" ON "public"."findings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (("c"."share_token" IS NOT NULL) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"())))))))));



CREATE POLICY "finding_select" ON "public"."findings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (("c"."share_token" IS NOT NULL) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"())))))))));



CREATE POLICY "finding_update" ON "public"."findings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."changeovers" "c"
     JOIN "public"."properties" "p" ON (("p"."id" = "c"."property_id")))
  WHERE (("c"."id" = "findings"."changeover_id") AND ("p"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."changeovers" "c"
     JOIN "public"."properties" "p" ON (("p"."id" = "c"."property_id")))
  WHERE (("c"."id" = "findings"."changeover_id") AND ("p"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."findings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "findings_insert_policy" ON "public"."findings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (("c"."share_token" IS NOT NULL) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"())))))))));



CREATE POLICY "findings_select_policy" ON "public"."findings" FOR SELECT USING ((("share_token" IS NOT NULL) OR (EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (("c"."share_token" IS NOT NULL) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"()))))))))));



CREATE POLICY "findings_update_notes_policy" ON "public"."findings" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND ("c"."share_token" IS NOT NULL)))) OR (EXISTS ( SELECT 1
   FROM ("public"."changeovers" "c"
     JOIN "public"."properties" "p" ON (("p"."id" = "c"."property_id")))
  WHERE (("c"."id" = "findings"."changeover_id") AND ("p"."created_by" = "auth"."uid"())))))) WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND ("c"."share_token" IS NOT NULL)))) AND "public"."verify_finding_notes_only"("findings".*, "notes")) OR (EXISTS ( SELECT 1
   FROM ("public"."changeovers" "c"
     JOIN "public"."properties" "p" ON (("p"."id" = "c"."property_id")))
  WHERE (("c"."id" = "findings"."changeover_id") AND ("p"."created_by" = "auth"."uid"()))))));



CREATE POLICY "findings_update_policy" ON "public"."findings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (("c"."share_token" IS NOT NULL) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"()))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (("c"."share_token" IS NOT NULL) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"())))))))));



ALTER TABLE "public"."ical_feed_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_access" ON "public"."properties" FOR SELECT TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "owner_update" ON "public"."properties" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."property_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_access" ON "public"."tasks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "tasks"."property_id") AND ("p"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."task_executions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_write" ON "public"."tasks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "tasks"."property_id") AND ("p"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "tasks"."property_id") AND ("p"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."utilities" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


CREATE PUBLICATION "supabase_realtime_messages_publication" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "supabase_realtime_messages_publication" OWNER TO "supabase_admin";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";















































































































































































































GRANT ALL ON FUNCTION "public"."add_uuids_to_content_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_uuids_to_content_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_uuids_to_content_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_access"("p_table" "text", "p_id" "uuid", "p_operation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_access"("p_table" "text", "p_id" "uuid", "p_operation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_access"("p_table" "text", "p_id" "uuid", "p_operation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_property_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_property_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_property_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_to_full_account"("p_anonymous_id" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_to_full_account"("p_anonymous_id" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_to_full_account"("p_anonymous_id" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_room_details"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_room_details"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_room_details"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_demo_property"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_demo_property"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_demo_property"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_finding_share_link"("finding_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_finding_share_link"("finding_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_finding_share_link"("finding_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_findings_from_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_findings_from_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_findings_from_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."disable_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."disable_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enable_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."enable_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enable_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_finding_share_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_finding_share_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_finding_share_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_anonymous_user"("p_anonymous_id" "text", "p_name" "text", "p_changeover_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_anonymous_user"("p_anonymous_id" "text", "p_name" "text", "p_changeover_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_anonymous_user"("p_anonymous_id" "text", "p_name" "text", "p_changeover_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_subscription_update"("p_user_id" "uuid", "p_tier_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_status" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_subscription_update"("p_user_id" "uuid", "p_tier_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_status" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_subscription_update"("p_user_id" "uuid", "p_tier_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_status" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_policy_check"("policy_name" "text", "table_name" "text", "operation" "text", "result" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."log_policy_check"("policy_name" "text", "table_name" "text", "operation" "text", "result" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_policy_check"("policy_name" "text", "table_name" "text", "operation" "text", "result" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."moddatetime"() TO "postgres";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "anon";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_changeover_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_changeover_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_changeover_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_changeover_status_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_changeover_status_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_changeover_status_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_finding_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_finding_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_finding_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_finding_status_changed"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_finding_status_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_finding_status_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_finding_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_finding_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_finding_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_type" "public"."notification_type", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_type" "public"."notification_type", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_notification"("p_user_id" "uuid", "p_type" "public"."notification_type", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_notification"("p_user_id" "uuid", "p_type" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_finding_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_finding_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_finding_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."should_include_task"("p_task_id" "uuid", "p_changeover_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."should_include_task"("p_task_id" "uuid", "p_changeover_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."should_include_task"("p_task_id" "uuid", "p_changeover_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."changeovers" TO "anon";
GRANT ALL ON TABLE "public"."changeovers" TO "authenticated";
GRANT ALL ON TABLE "public"."changeovers" TO "service_role";



GRANT ALL ON FUNCTION "public"."update_changeover_status"("changeover_id_input" "uuid", "new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_changeover_status"("changeover_id_input" "uuid", "new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_changeover_status"("changeover_id_input" "uuid", "new_status" "text") TO "service_role";



GRANT ALL ON TABLE "public"."changeover_tasks" TO "anon";
GRANT ALL ON TABLE "public"."changeover_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."changeover_tasks" TO "service_role";



GRANT ALL ON FUNCTION "public"."update_changeover_task_status"("changeover_id_input" "uuid", "task_id_input" "uuid", "new_status" "public"."task_status") TO "anon";
GRANT ALL ON FUNCTION "public"."update_changeover_task_status"("changeover_id_input" "uuid", "task_id_input" "uuid", "new_status" "public"."task_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_changeover_task_status"("changeover_id_input" "uuid", "task_id_input" "uuid", "new_status" "public"."task_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_properties_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_properties_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_properties_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_room_details_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_room_details_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_room_details_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_content_items"("contents" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_content_items"("contents" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_content_items"("contents" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_content_items_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_content_items_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_content_items_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_scheduling_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_scheduling_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_scheduling_rules"() TO "service_role";



GRANT ALL ON TABLE "public"."findings" TO "anon";
GRANT ALL ON TABLE "public"."findings" TO "authenticated";
GRANT ALL ON TABLE "public"."findings" TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_finding_notes_only"("finding_record" "public"."findings", "new_notes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_finding_notes_only"("finding_record" "public"."findings", "new_notes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_finding_notes_only"("finding_record" "public"."findings", "new_notes" "jsonb") TO "service_role";
























GRANT ALL ON TABLE "public"."anonymous_users" TO "anon";
GRANT ALL ON TABLE "public"."anonymous_users" TO "authenticated";
GRANT ALL ON TABLE "public"."anonymous_users" TO "service_role";



GRANT ALL ON TABLE "public"."ical_feed_access" TO "anon";
GRANT ALL ON TABLE "public"."ical_feed_access" TO "authenticated";
GRANT ALL ON TABLE "public"."ical_feed_access" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notification_queue" TO "anon";
GRANT ALL ON TABLE "public"."notification_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_queue" TO "service_role";



GRANT ALL ON TABLE "public"."notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON TABLE "public"."property_tasks" TO "anon";
GRANT ALL ON TABLE "public"."property_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."property_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."room_details" TO "anon";
GRANT ALL ON TABLE "public"."room_details" TO "authenticated";
GRANT ALL ON TABLE "public"."room_details" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_history" TO "anon";
GRANT ALL ON TABLE "public"."subscription_history" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_history" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tiers" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."task_executions" TO "anon";
GRANT ALL ON TABLE "public"."task_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."task_executions" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."utilities" TO "anon";
GRANT ALL ON TABLE "public"."utilities" TO "authenticated";
GRANT ALL ON TABLE "public"."utilities" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
