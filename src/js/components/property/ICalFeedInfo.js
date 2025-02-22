import { IconService } from '../../services/IconService.js';
import { supabase } from '../../lib/supabase.js';
import { showSuccessAlert } from '../../utils/alertUtils.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export class ICalFeedInfo {
  constructor(containerId, propertyId = null) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    if (!this.container) {
      console.error('iCal feed info container not found');
      return;
    }
    this.initialize();
  }

  async initialize() {
    await this.ensureFeedToken();
    this.render();
    this.attachEventListeners();
  }

  async ensureFeedToken() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      // Check if feed token exists
      const { data: existingToken } = await supabase
        .from('ical_feed_access')
        .select('token')
        .eq('user_id', user.id)
        .eq('property_id', this.propertyId)
        .maybeSingle();

      let globalToken = null;
      if (!existingToken && !this.propertyId) {
        // Try global feed token
        const { data: token } = await supabase
          .from('ical_feed_access')
          .select('token')
          .eq('user_id', user.id)
          .is('property_id', null)
          .maybeSingle();
        globalToken = token;
      }

      if (existingToken?.token) {
        this.feedToken = existingToken.token;
        return;
      } else if (globalToken?.token) {
        this.feedToken = globalToken.token;
        return;
      }

      // Create new feed token
      const { data: newToken, error } = await supabase
        .from('ical_feed_access')
        .insert({
          user_id: user.id,
          property_id: this.propertyId,
          token: crypto.randomUUID()
        })
        .select('token')
        .single();

      if (error) throw error;
      this.feedToken = newToken.token;
    } catch (error) {
      console.error('Failed to ensure feed token:', error);
      this.feedToken = null;
    }
  }

  async getFeedUrl() {
    if (!this.feedToken) return null;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const params = new URLSearchParams({
        userId: user.id,
        token: this.feedToken
      });
      
      if (this.propertyId) {
        params.append('propertyId', this.propertyId);
      }

      return `${supabaseUrl}/functions/v1/serve-ical?${params.toString()}`;
    } catch (error) {
      console.error('Failed to get feed URL:', error);
      return null;
    }
  }

  async render() {
    const feedUrl = await this.getFeedUrl();
    if (!feedUrl) {
      this.container.innerHTML = `
        <p class="text-warning d-flex align-items-center gap-2">
          ${IconService.createIcon('ExclamationTriangle')}
          Unable to generate calendar feed URL. Please try refreshing the page.
        </p>
      `;
      return;
    }

    this.container.innerHTML = `
      <p class="card-text">
        Subscribe to your changeovers in your preferred calendar application:
      </p>
      <div class="input-group">
        <input type="text" class="form-control" value="${feedUrl}" readonly>
        <button class="btn btn-outline-primary" type="button" data-action="copy-url">
          ${IconService.createIcon('Copy')}
          Copy
        </button>
      </div>
      <div class="mt-3">
        <small class="text-muted">
          This URL is private to your account. Don't share it with others.
        </small>
      </div>
    `;
  }

  attachEventListeners() {
    this.container.addEventListener('click', async (e) => {
      const copyButton = e.target.closest('[data-action="copy-url"]');
      if (!copyButton) return;

      const input = this.container.querySelector('input');
      await navigator.clipboard.writeText(input.value);
      
      showSuccessAlert('Calendar feed URL copied to clipboard');
    });
  }
}
