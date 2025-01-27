import { UserSettings } from '../components/settings/UserSettings.js';
import { Navigation } from '../components/ui/Navigation.js';
import { authStore } from '../auth/AuthStore.js';

export async function initializeSettingsView(services, elements) {
  if (!authStore.isAuthenticated()) {
    throw new Error('Please sign in to view settings');
  }

  elements.propertyList.style.display = 'none';
  elements.changeoverList.style.display = 'none';
  elements.findingsView.style.display = 'none';
  elements.propertyDetails.style.display = 'block';

  elements.propertyDetails.innerHTML = `
    <div class="mb-4">
      ${Navigation.renderBackButton()}
    </div>
    <div id="userSettings"></div>
  `;

  new UserSettings('userSettings');
}