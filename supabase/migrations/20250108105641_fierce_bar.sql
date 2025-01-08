-- Add Stripe subscription ID column
ALTER TABLE subscriptions
ADD COLUMN stripe_subscription_id text;

-- Create index for faster lookups
CREATE INDEX idx_subscriptions_stripe_id 
ON subscriptions(stripe_subscription_id);