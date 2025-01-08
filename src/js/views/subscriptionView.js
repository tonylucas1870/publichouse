import { SubscriptionTiers } from '../components/subscription/SubscriptionTiers.js';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { Navigation } from '../components/ui/Navigation.js';

export async function initializeSubscriptionView(services, elements) {
  try {
    elements.propertyList.style.display = 'none';
    elements.changeoverList.style.display = 'none';
    elements.findingsView.style.display = 'none';
    elements.propertyDetails.style.display = 'block';

    elements.propertyDetails.innerHTML = `
      <div class="mb-4">
        ${Navigation.renderBackButton()}
      </div>
      <div id="subscriptionTiers"></div>
    `;

    new SubscriptionTiers('subscriptionTiers', new SubscriptionService());
  } catch (error) {
    console.error('Error initializing subscription view:', error);
    showErrorAlert(error.message || 'Failed to load subscription details');
  }
}