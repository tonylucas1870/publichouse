-- Drop duplicate column if it exists
ALTER TABLE subscriptions 
DROP COLUMN IF EXISTS stripe_subscription_id;

-- Add Stripe columns with proper constraints
ALTER TABLE subscriptions
ADD COLUMN stripe_customer_id text,
ADD COLUMN stripe_subscription_id text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id 
ON subscriptions(stripe_subscription_id);

-- Create index for customer lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id
ON subscriptions(stripe_customer_id);