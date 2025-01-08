-- Add Stripe fields to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN stripe_customer_id text,
ADD COLUMN stripe_subscription_id text;

-- Create function to archive subscriptions
CREATE OR REPLACE FUNCTION archive_subscription(subscription_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record subscriptions%ROWTYPE;
BEGIN
  -- Get subscription details
  SELECT * INTO sub_record
  FROM subscriptions
  WHERE stripe_subscription_id = subscription_id;

  -- Add to history
  INSERT INTO subscription_history (
    subscription_id,
    tier_id,
    status,
    period_start,
    period_end
  ) VALUES (
    sub_record.id,
    sub_record.tier_id,
    sub_record.status,
    sub_record.current_period_start,
    sub_record.current_period_end
  );

  -- Delete subscription
  DELETE FROM subscriptions
  WHERE stripe_subscription_id = subscription_id;
END;
$$;