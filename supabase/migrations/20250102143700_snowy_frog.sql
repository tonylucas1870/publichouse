-- Step 1: Drop materialized views and related objects
DROP MATERIALIZED VIEW IF EXISTS mv_owned_properties CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_shared_changeovers CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_property_access CASCADE;

-- Step 2: Drop refresh functions and triggers
DROP FUNCTION IF EXISTS refresh_access_views() CASCADE;
DROP FUNCTION IF EXISTS refresh_property_access() CASCADE;

-- Step 3: Drop any remaining view-related indexes
DROP INDEX IF EXISTS idx_mv_owned_properties_created_by CASCADE;
DROP INDEX IF EXISTS idx_mv_shared_changeovers_property_id CASCADE;
DROP INDEX IF EXISTS idx_mv_property_access_unique CASCADE;
DROP INDEX IF EXISTS idx_mv_property_access_user_unique CASCADE;
DROP INDEX IF EXISTS idx_mv_property_access_user CASCADE;
DROP INDEX IF EXISTS idx_mv_property_access_owner CASCADE;

-- Step 4: Ensure core indexes still exist
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_changeovers_property_id ON changeovers(property_id);
CREATE INDEX IF NOT EXISTS idx_changeovers_share_token ON changeovers(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_changeover_id ON findings(changeover_id);