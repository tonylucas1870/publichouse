-- Add unique constraint for user_id
ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);

-- Recreate function with proper error handling
CREATE OR REPLACE FUNCTION handle_subscription_update(
  p_user_id uuid,
  p_tier_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean
)
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
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