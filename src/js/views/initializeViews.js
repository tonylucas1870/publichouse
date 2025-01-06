import { AuthHeader } from '../components/auth/AuthHeader.js';
import { initializeLayout } from './layout.js';
import { initializeHomeView } from './homeView.js';
import { initializePropertyView } from './propertyView.js';
import { initializeChangeoverView } from './changeoverView.js';
import { initializeSharedView } from './sharedView.js';
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

    // Handle unauthenticated state
    if (!authStore.isAuthenticated() && !shareToken) {
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
      if (shareToken) {
        await initializeSharedView(services, elements, shareToken);
      } else if (changeoverId) {
        await initializeChangeoverView(services, elements, changeoverId);
      } else if (propertyId) {
        await initializePropertyView(services, elements, propertyId);
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