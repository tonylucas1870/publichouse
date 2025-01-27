import { UserSettings } from '../components/settings/UserSettings.js';
import { showErrorAlert } from '../utils/alertUtils.js';

export async function initializeSettingsView(services, elements) {
  try {
    // Hide other views
    elements.propertyList.style.display = 'none';
    elements.changeoverList.style.display = 'none';
    elements.findingsView.style.display = 'none';
    elements.propertyDetails.style.display = 'block';

    // Initialize settings
    new UserSettings('propertyDetails');
  } catch (error) {
    console.error('Error initializing settings view:', error);
    showErrorAlert(error.message || 'Failed to load settings');
  }
}