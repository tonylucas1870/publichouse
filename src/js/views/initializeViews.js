import { AuthHeader } from '../components/auth/AuthHeader.js';
import { initializeLayout } from './layout.js';
import { initializeHomeView } from './homeView.js';
import { initializePropertyView } from './propertyView.js';
import { initializeChangeoverView } from './changeoverView.js';
import { initializeSharedView } from './sharedView.js';
import { initializeSettingsView } from './settingsView.js';
import { initializeSubscriptionView } from './subscriptionView.js';
import { FindingModal } from '../components/findings/FindingModal.js';
import { authStore } from '../auth/AuthStore.js';
import { showErrorAlert } from '../utils/alertUtils.js';

export async function initializeViews(services) {
  try {
    // Initialize auth first and wait for it to complete
    await authStore.initialize();

    // Initialize layout
    const elements = initializeLayout();
    if (!elements) {
      throw new Error('Failed to initialize layout');
    }

    // Initialize header
    new AuthHeader();

    // Get current page parameters
    const params = new URLSearchParams(window.location.search);
    const changeoverId = params.get('changeover');
    const shareToken = params.get('token');
    const propertyId = params.get('property');
    const subscription = params.get('subscription');
    const settings = params.get('settings');
    const findingToken = params.get('finding');

    // Handle unauthenticated state
    if (!authStore.isAuthenticated() && !shareToken && !findingToken) {
      elements.propertyList.style.display = 'block';
      elements.propertyList.innerHTML = `
        <div class="text-center p-4">
          <p class="text-muted">Please sign in to view properties and changeovers.</p>
        </div>
      `;
      return;
    }

    // Initialize appropriate view based on URL parameters
    try {
      if (findingToken) {
        // Show shared finding
        try {
          const finding = await services.findings.getFindingByShareToken(findingToken);
          if (!finding) throw new Error('Invalid finding share token');
          
          elements.findingsView.style.display = 'block';
          FindingModal.show(
            finding, 
            services.findings,
            null, // No status updates for shared findings
            async (findingId, text) => services.findings.addNote(findingId, text)
          );
        } catch (error) {
          // Show user-friendly error message
          document.body.innerHTML = `
            <div class="container py-5">
              <div class="alert alert-danger">
                <h4 class="alert-heading">Invalid Finding Link</h4>
                <p>The finding you're trying to access is either invalid or has expired.</p>
                <hr>
                <p class="mb-0">
                  <a href="/" class="alert-link">Return to Home</a>
                </p>
              </div>
            </div>
          `;
          return;
        }
      } else if (shareToken) {
        // Always use sharedView for share token URLs
        await initializeSharedView({
          auth: authStore,
          changeover: services.changeover,
          findings: services.findings,
          anonymous: services.anonymous
        }, elements, shareToken);
      } else if (changeoverId) {
        // Only use changeoverView for authenticated changeover access
        await initializeChangeoverView({
          auth: authStore,
          changeover: services.changeover,
          findings: services.findings,
          anonymous: services.anonymous
        }, elements, changeoverId);
      } else if (propertyId) {
        await initializePropertyView(services, elements, propertyId);
      } else if (subscription === 'manage') {
        await initializeSubscriptionView(services, elements);
      } else if (settings === 'manage') {
        await initializeSettingsView(services, elements);
      } else {
        await initializeHomeView(services, elements);
      }
    } catch (viewError) {
      console.error('View initialization error:', viewError);
      
      // Show error message to user
      showErrorAlert(viewError.message || 'Failed to load requested content');
      
      // Fall back to home view on error if authenticated
      if (authStore.isAuthenticated()) {
        await initializeHomeView(services, elements);
      }
    }
  } catch (error) {
    console.error('Application initialization error:', error);
    showErrorAlert('Failed to initialize application. Please try refreshing the page.');
    
    // Show error state in UI
    document.body.innerHTML = `
      <div class="container py-5">
        <div class="alert alert-danger">
          <h4 class="alert-heading">Application Error</h4>
          <p>${error.message || 'Failed to initialize application'}</p>
          <hr>
          <p class="mb-0">Please try refreshing the page. If the problem persists, contact support.</p>
        </div>
      </div>
    `;
  }
}