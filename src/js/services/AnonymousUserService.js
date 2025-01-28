import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class AnonymousUserService {
  constructor() {
    console.debug('AnonymousUserService: Initializing', {
      hasAnonymousId: !!localStorage.getItem('anonymousId'),
      anonymousId: localStorage.getItem('anonymousId')
    });
    this.anonymousId = localStorage.getItem('anonymousId');
  }

  isAnonymous() {
    console.debug('AnonymousUserService: Checking anonymous status', {
      isAnonymous: !!this.anonymousId,
      anonymousId: this.anonymousId
    });
    return !!this.anonymousId;
  }

  getAnonymousId() {
    return this.anonymousId;
  }

  async getOrCreateUser(name, changeoverId) {
    try {
      console.debug('AnonymousUserService: Getting/creating user', {
        name,
        changeoverId,
        existingAnonymousId: this.anonymousId
      });

      // Generate anonymous ID if none exists
      if (!this.anonymousId) {
        this.anonymousId = crypto.randomUUID();
        localStorage.setItem('anonymousId', this.anonymousId);
        console.debug('AnonymousUserService: Generated new anonymous ID', {
          anonymousId: this.anonymousId
        });
      }

      // Set anonymous ID in Supabase config
      const { data, error } = await supabase.rpc('get_or_create_anonymous_user', {
        p_anonymous_id: this.anonymousId,
        p_name: name,
        p_changeover_id: changeoverId
      });

      if (error) throw error;
      console.debug('AnonymousUserService: User created/updated', { data });

      // Store name for future use
      localStorage.setItem('anonymousName', name);

      return {
        anonymousId: this.anonymousId,
        name
      };
    } catch (error) {
      console.error('Error managing anonymous user:', error);
      console.debug('AnonymousUserService: Full error details', {
        error,
        anonymousId: this.anonymousId,
        name,
        changeoverId
      });
      throw handleSupabaseError(error, 'Failed to manage anonymous user');
    }
  }

  async convertToFullAccount(email, password) {
    try {
      if (!this.anonymousId) {
        throw new Error('No anonymous user to convert');
      }

      // Create new auth user
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError) throw signUpError;

      // Convert anonymous user to full account
      await supabase.rpc('convert_to_full_account', {
        p_anonymous_id: this.anonymousId,
        p_user_id: user.id
      });

      // Clear anonymous user data
      localStorage.removeItem('anonymousId');
      localStorage.removeItem('anonymousName');

      return user;
    } catch (error) {
      console.error('Error converting to full account:', error);
      throw handleSupabaseError(error, 'Failed to create account');
    }
  }

  getName() {
    return localStorage.getItem('anonymousName');
  }
}