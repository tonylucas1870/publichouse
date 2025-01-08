/*
  # Add subscription capabilities
  
  1. New Tables
    - `subscription_tiers` - Available subscription plans
    - `subscriptions` - User subscriptions
    - `subscription_history` - Track subscription changes
  
  2. Changes
    - Add subscription checks to properties table
    
  3. Security
    - Enable RLS
    - Add policies for subscription management
*/

-- Create subscription tiers table
CREATE TABLE subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  property_limit integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier_id uuid REFERENCES subscription_tiers(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create subscription history table
CREATE TABLE subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  tier_id uuid REFERENCES subscription_tiers(id) NOT NULL,
  status text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can view subscription tiers"
ON subscription_tiers FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can view own subscription"
ON subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view own subscription history"
ON subscription_history FOR SELECT
TO authenticated
USING (
  subscription_id IN (
    SELECT id FROM subscriptions WHERE user_id = auth.uid()
  )
);

-- Create function to check property limit
CREATE OR REPLACE FUNCTION check_property_limit()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to enforce property limit
CREATE TRIGGER check_property_limit_trigger
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION check_property_limit();

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, description, price, property_limit) VALUES
  ('Free', 'Basic access with one property', 0, 1),
  ('Pro', 'Up to 5 properties with advanced features', 9.99, 5),
  ('Business', 'Unlimited properties with priority support', 29.99, 999999);

-- Create indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tier_id ON subscriptions(tier_id);
CREATE INDEX idx_subscription_history_subscription_id ON subscription_history(subscription_id);