

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


CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



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


CREATE TYPE "public"."task_status" AS ENUM (
    'not_started',
    'in_progress',
    'complete',
    'blocked'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


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
    CONSTRAINT "findings_images_is_array" CHECK (("jsonb_typeof"("images") = 'array'::"text")),
    CONSTRAINT "findings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'fixed'::"text", 'wont_fix'::"text"])))
);


ALTER TABLE "public"."findings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "calendar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "calendar_sync_status" "public"."calendar_sync_status" DEFAULT 'pending'::"public"."calendar_sync_status",
    "calendar_last_synced" timestamp with time zone,
    "calendar_sync_error" "text"
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_property_id_title_key" UNIQUE ("property_id", "title");



ALTER TABLE ONLY "public"."utilities"
    ADD CONSTRAINT "utilities_pkey" PRIMARY KEY ("id");



CREATE INDEX "changeovers_calendar_booking_idx" ON "public"."changeovers" USING "btree" ("calendar_booking_id");



CREATE INDEX "changeovers_property_id_idx" ON "public"."changeovers" USING "btree" ("property_id");



CREATE INDEX "changeovers_share_token_idx" ON "public"."changeovers" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "findings_changeover_id_idx" ON "public"."findings" USING "btree" ("changeover_id");



CREATE INDEX "findings_notes_idx" ON "public"."findings" USING "gin" ("notes");



CREATE INDEX "findings_status_changeover_idx" ON "public"."findings" USING "btree" ("status", "changeover_id");



CREATE INDEX "findings_status_idx" ON "public"."findings" USING "btree" ("status");



CREATE INDEX "idx_changeover_tasks_changeover_id" ON "public"."changeover_tasks" USING "btree" ("changeover_id");



CREATE INDEX "idx_changeover_tasks_status" ON "public"."changeover_tasks" USING "btree" ("status");



CREATE INDEX "idx_changeover_tasks_task_id" ON "public"."changeover_tasks" USING "btree" ("task_id");



CREATE INDEX "idx_changeovers_property_id" ON "public"."changeovers" USING "btree" ("property_id");



CREATE INDEX "idx_changeovers_property_lookup" ON "public"."changeovers" USING "btree" ("property_id", "share_token");



CREATE INDEX "idx_changeovers_share_token" ON "public"."changeovers" USING "btree" ("share_token") WHERE ("share_token" IS NOT NULL);



CREATE INDEX "idx_findings_changeover_id" ON "public"."findings" USING "btree" ("changeover_id");



CREATE INDEX "idx_findings_content_item" ON "public"."findings" USING "gin" ("content_item");



CREATE INDEX "idx_findings_status" ON "public"."findings" USING "btree" ("status");



CREATE INDEX "idx_properties_created_by" ON "public"."properties" USING "btree" ("created_by");



CREATE INDEX "idx_subscription_history_subscription_id" ON "public"."subscription_history" USING "btree" ("subscription_id");



CREATE INDEX "idx_subscriptions_customer_id" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_stripe_id" ON "public"."subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_subscriptions_tier_id" ON "public"."subscriptions" USING "btree" ("tier_id");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_property_id" ON "public"."tasks" USING "btree" ("property_id");



CREATE INDEX "properties_created_by_idx" ON "public"."properties" USING "btree" ("created_by");



CREATE OR REPLACE TRIGGER "check_property_limit_trigger" BEFORE INSERT ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."check_property_limit"();



CREATE OR REPLACE TRIGGER "create_room_details_trigger" AFTER INSERT ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_room_details"();



CREATE OR REPLACE TRIGGER "update_properties_timestamp" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."update_properties_updated_at"();



CREATE OR REPLACE TRIGGER "update_room_details_timestamp" BEFORE UPDATE ON "public"."room_details" FOR EACH ROW EXECUTE FUNCTION "public"."update_room_details_updated_at"();



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
    ADD CONSTRAINT "findings_changeover_id_fkey" FOREIGN KEY ("changeover_id") REFERENCES "public"."changeovers"("id");



ALTER TABLE ONLY "public"."findings"
    ADD CONSTRAINT "findings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



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



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utilities"
    ADD CONSTRAINT "utilities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



CREATE POLICY "Anyone can view rooms for shared changeovers" ON "public"."rooms" FOR SELECT USING (("property_id" IN ( SELECT "changeovers"."property_id"
   FROM "public"."changeovers"
  WHERE ("changeovers"."share_token" IS NOT NULL))));



CREATE POLICY "Anyone with share token can view changeover" ON "public"."changeovers" FOR SELECT USING (("share_token" IS NOT NULL));



CREATE POLICY "Authenticated users can create findings" ON "public"."findings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Public can view subscription tiers" ON "public"."subscription_tiers" FOR SELECT USING (true);



CREATE POLICY "Users can create changeovers" ON "public"."changeovers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create properties" ON "public"."properties" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can create rooms for their properties" ON "public"."rooms" FOR INSERT TO "authenticated" WITH CHECK (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can create utilities for their properties" ON "public"."utilities" FOR INSERT TO "authenticated" WITH CHECK (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can delete rooms for their properties" ON "public"."rooms" FOR DELETE TO "authenticated" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can delete utilities for their properties" ON "public"."utilities" FOR DELETE TO "authenticated" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can insert room details for their properties" ON "public"."room_details" FOR INSERT TO "authenticated" WITH CHECK (("room_id" IN ( SELECT "r"."id"
   FROM ("public"."rooms" "r"
     JOIN "public"."properties" "p" ON (("r"."property_id" = "p"."id")))
  WHERE ("p"."created_by" = "auth"."uid"()))));



CREATE POLICY "Users can update calendar sync status" ON "public"."properties" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



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



CREATE POLICY "Users can view utilities for their properties" ON "public"."utilities" FOR SELECT TO "authenticated" USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."created_by" = "auth"."uid"()))));



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


CREATE POLICY "finding_access" ON "public"."findings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (("c"."share_token" IS NOT NULL) OR (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"())))))))));



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
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."changeovers" "c"
  WHERE (("c"."id" = "findings"."changeover_id") AND (EXISTS ( SELECT 1
           FROM "public"."properties" "p"
          WHERE (("p"."id" = "c"."property_id") AND ("p"."created_by" = "auth"."uid"()))))))));



ALTER TABLE "public"."findings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_access" ON "public"."properties" FOR SELECT TO "authenticated" USING (("created_by" = "auth"."uid"()));



CREATE POLICY "owner_update" ON "public"."properties" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_access" ON "public"."tasks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "tasks"."property_id") AND ("p"."created_by" = "auth"."uid"())))));



CREATE POLICY "task_write" ON "public"."tasks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "tasks"."property_id") AND ("p"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "tasks"."property_id") AND ("p"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."utilities" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."check_access"("p_table" "text", "p_id" "uuid", "p_operation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_access"("p_table" "text", "p_id" "uuid", "p_operation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_access"("p_table" "text", "p_id" "uuid", "p_operation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_property_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_property_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_property_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_room_details"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_room_details"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_room_details"() TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_subscription_update"("p_user_id" "uuid", "p_tier_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_status" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_subscription_update"("p_user_id" "uuid", "p_tier_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_status" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_subscription_update"("p_user_id" "uuid", "p_tier_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_status" "text", "p_period_start" timestamp with time zone, "p_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_policy_check"("policy_name" "text", "table_name" "text", "operation" "text", "result" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."log_policy_check"("policy_name" "text", "table_name" "text", "operation" "text", "result" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_policy_check"("policy_name" "text", "table_name" "text", "operation" "text", "result" boolean) TO "service_role";



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


















GRANT ALL ON TABLE "public"."findings" TO "anon";
GRANT ALL ON TABLE "public"."findings" TO "authenticated";
GRANT ALL ON TABLE "public"."findings" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



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



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



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
