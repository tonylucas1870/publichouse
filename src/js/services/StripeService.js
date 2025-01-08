import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

let stripePromise;

export class StripeService {
  constructor() {
    const publicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('Stripe public key not found');
    }
    stripePromise = loadStripe(publicKey);
  }

  async createCheckoutSession(tierId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Call Supabase Edge Function to create checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { tierId }
      });

      if (error) throw error;

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId
      });

      if (stripeError) throw stripeError;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to start checkout');
    }
  }

  async createPortalSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Call Supabase Edge Function to create portal session
      const { data, error } = await supabase.functions.invoke('create-portal-session');

      if (error) throw error;

      // Redirect to Customer Portal
      window.location.href = data.url;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to open customer portal');
    }
  }
}