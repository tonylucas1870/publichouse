import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import Stripe from 'https://esm.sh/stripe@14.12.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') as string;

serve(async (req) => {
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'No signature' }),
        { status: 400 }
      );
    }

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      endpointSecret
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { user_id, tier_id } = session.metadata;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        // Create or update subscription
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id,
            tier_id,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
          });

        if (error) throw error;
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Update subscription status
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id);

        if (error) throw error;
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        // Add to history and delete subscription
        await supabase.rpc('archive_subscription', {
          subscription_id: subscription.id
        });
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});