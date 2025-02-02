-- Drop existing triggers first to ensure clean state
DROP TRIGGER IF EXISTS notify_changeover_created ON changeovers;
DROP TRIGGER IF EXISTS notify_changeover_status_changed ON changeovers;
DROP TRIGGER IF EXISTS notify_finding_created ON findings;
DROP TRIGGER IF EXISTS notify_finding_status_changed ON findings;
DROP TRIGGER IF EXISTS notify_finding_updated ON findings;

-- Recreate triggers with proper event timing
CREATE TRIGGER notify_changeover_created
  AFTER INSERT ON changeovers
  FOR EACH ROW
  EXECUTE FUNCTION notify_changeover_created();

CREATE TRIGGER notify_changeover_status_changed
  AFTER UPDATE OF status ON changeovers
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_changeover_status_changed();

CREATE TRIGGER notify_finding_created
  AFTER INSERT ON findings
  FOR EACH ROW
  EXECUTE FUNCTION notify_finding_created();

CREATE TRIGGER notify_finding_status_changed
  AFTER UPDATE OF status ON findings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_finding_status_changed();

CREATE TRIGGER notify_finding_updated
  AFTER UPDATE ON findings
  FOR EACH ROW
  WHEN (
    OLD.notes IS DISTINCT FROM NEW.notes OR
    OLD.images IS DISTINCT FROM NEW.images
  )
  EXECUTE FUNCTION notify_finding_updated();

-- Add function to disable notifications temporarily if needed
CREATE OR REPLACE FUNCTION disable_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE changeovers DISABLE TRIGGER notify_changeover_created;
  ALTER TABLE changeovers DISABLE TRIGGER notify_changeover_status_changed;
  ALTER TABLE findings DISABLE TRIGGER notify_finding_created;
  ALTER TABLE findings DISABLE TRIGGER notify_finding_status_changed;
  ALTER TABLE findings DISABLE TRIGGER notify_finding_updated;
END;
$$;

-- Add function to re-enable notifications
CREATE OR REPLACE FUNCTION enable_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE changeovers ENABLE TRIGGER notify_changeover_created;
  ALTER TABLE changeovers ENABLE TRIGGER notify_changeover_status_changed;
  ALTER TABLE findings ENABLE TRIGGER notify_finding_created;
  ALTER TABLE findings ENABLE TRIGGER notify_finding_status_changed;
  ALTER TABLE findings ENABLE TRIGGER notify_finding_updated;
END;
$$;