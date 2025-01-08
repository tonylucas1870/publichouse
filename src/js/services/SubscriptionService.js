import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class SubscriptionService {
  async getSubscriptionTiers() {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .order('price');

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load subscription tiers');
    }
  }

  async getCurrentSubscription() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          tier:subscription_tiers (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load subscription');
    }
  }

  async getSubscriptionHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('subscription_history')
        .select(`
          *,
          tier:subscription_tiers (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load subscription history');
    }
  }

  async getRemainingProperties() {
    try {
      const subscription = await this.getCurrentSubscription();
      const propertyLimit = subscription?.tier?.property_limit || 1; // Free tier limit

      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      
      return {
        used: count || 0,
        limit: propertyLimit,
        remaining: Math.max(0, propertyLimit - (count || 0))
      };
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to check property limit');
    }
  }
}