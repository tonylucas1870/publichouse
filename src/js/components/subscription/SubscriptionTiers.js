import { IconService } from '../../services/IconService.js';
import { StripeService } from '../../services/StripeService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { formatCurrency } from '../../utils/formatUtils.js';

export class SubscriptionTiers {
  constructor(containerId, subscriptionService) {
    this.container = document.getElementById(containerId);
    this.subscriptionService = subscriptionService;
    this.stripeService = new StripeService();
    this.initialize();
  }

  async initialize() {
    try {
      const [tiers, currentSubscription, propertyStats] = await Promise.all([
        this.subscriptionService.getSubscriptionTiers(),
        this.subscriptionService.getCurrentSubscription(),
        this.subscriptionService.getRemainingProperties()
      ]);

      this.render(tiers, currentSubscription, propertyStats);
      this.attachEventListeners();
    } catch (error) {
      console.error('Error initializing subscription tiers:', error);
      this.showError(error.message);
    }
  }

  render(tiers, currentSubscription, propertyStats) {
    this.container.innerHTML = `
      <div class="card mb-4">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Current Plan</h5>
            ${currentSubscription ? `
              <button class="btn btn-outline-primary btn-sm" id="manageSubscriptionBtn">
                ${IconService.createIcon('Settings')}
                Manage Subscription
              </button>
            ` : ''}
          </div>
          ${this.renderCurrentPlan(currentSubscription, propertyStats)}
        </div>
      </div>

      <div class="row row-cols-1 row-cols-md-3 g-4">
        ${tiers.map(tier => this.renderTierCard(tier, currentSubscription)).join('')}
      </div>
    `;
  }

  renderCurrentPlan(subscription, stats) {
    if (!subscription) {
      return `
        <div class="alert alert-info mb-0">
          <div class="d-flex align-items-center gap-2">
            ${IconService.createIcon('Info')}
            You're currently on the free plan
          </div>
          <div class="mt-2">
            <small>
              Using ${stats.used} of ${stats.limit} available ${stats.limit === 1 ? 'property' : 'properties'}
            </small>
          </div>
        </div>
      `;
    }

    return `
      <div class="alert ${subscription.status === 'active' ? 'alert-success' : 'alert-warning'} mb-0">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="alert-heading">${subscription.tier.name}</h6>
            <div class="mt-2">
              <small>
                Using ${stats.used} of ${stats.limit} available ${stats.limit === 1 ? 'property' : 'properties'}
              </small>
            </div>
          </div>
          <div class="text-end">
            <div class="text-muted">
              ${formatCurrency(subscription.tier.price)}/month
            </div>
            ${subscription.cancel_at_period_end ? `
              <small class="text-warning">
                Cancels at end of billing period
              </small>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderTierCard(tier, currentSubscription) {
    const isCurrentTier = currentSubscription?.tier_id === tier.id;
    
    return `
      <div class="col">
        <div class="card h-100 ${isCurrentTier ? 'border-primary' : ''}">
          <div class="card-body">
            <h5 class="card-title">${tier.name}</h5>
            <h6 class="card-subtitle mb-2 text-muted">
              ${formatCurrency(tier.price)}/month
            </h6>
            <p class="card-text">${tier.description}</p>
            <ul class="list-unstyled mb-4">
              <li class="mb-2 d-flex align-items-center gap-2">
                ${IconService.createIcon('Home')}
                Up to ${tier.property_limit === 999999 ? 'Unlimited' : tier.property_limit} properties
              </li>
            </ul>
            ${isCurrentTier ? `
              <button class="btn btn-outline-primary w-100" disabled>
                Current Plan
              </button>
            ` : `
              <button class="btn btn-primary w-100 select-tier" data-tier-id="${tier.id}">
                ${tier.price === 0 ? 'Start Free' : 'Select Plan'}
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        ${message || 'Failed to load subscription tiers'}
      </div>
    `;
  }

  attachEventListeners() {
    // Handle tier selection
    this.container.querySelectorAll('.select-tier').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const tierId = btn.dataset.tierId;
          await this.stripeService.createCheckoutSession(tierId);
        } catch (error) {
          console.error('Error selecting tier:', error);
          showErrorAlert(error.message);
        }
      });
    });

    // Handle subscription management
    const manageBtn = this.container.querySelector('#manageSubscriptionBtn');
    if (manageBtn) {
      manageBtn.addEventListener('click', async () => {
        try {
          await this.stripeService.createPortalSession();
        } catch (error) {
          console.error('Error opening customer portal:', error);
          showErrorAlert(error.message);
        }
      });
    }
  }
}