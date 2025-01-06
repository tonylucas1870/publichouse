import { AuthHeader } from '../components/auth/AuthHeader.js';
import { PropertyList } from '../components/property/PropertyList.js';
import { ChangeoverList } from '../components/changeover/ChangeoverList.js';
import { PropertyDetails } from '../components/property/PropertyDetails.js';
import { ChangeoverHeader } from '../components/changeover/ChangeoverHeader.js';
import { FindingsList } from '../components/findings/FindingsList.js';
import { UploadForm } from '../components/findings/UploadForm.js';
import { showErrorAlert } from './alertUtils.js';
import { authStore } from '../auth/AuthStore.js';

function initializeLayout() {
  document.body.innerHTML = `
    <header>
      <nav class="navbar navbar-light bg-white shadow-sm mb-4">
        <div class="container">
          <!-- Navigation content will be injected here -->
        </div>
      </nav>
    </header>

    <main class="container py-4">
      <div id="propertyList" class="mb-5"></div>
      <div id="propertyDetails"></div>
      <div id="changeoverHeader"></div>
      <div id="changeoverList"></div>
      <div id="findingsView">
        <div id="uploadForm" class="mb-4"></div>
        <div id="findingsList"></div>
      </div>
    </main>
  `;
}

function getViewElements() {
  return {
    findingsView: document.getElementById('findingsView'),
    propertyList: document.getElementById('propertyList'),
    changeoverList: document.getElementById('changeoverList'),
    changeoverHeader: document.getElementById('changeoverHeader'),
    propertyDetails: document.getElementById('propertyDetails')
  };
}

function hideAllViews(elements) {
  Object.values(elements).forEach(el => {
    if (el) el.style.display = 'none';
  });
}

export async function initializeViews(services) {
  try {
    // Initialize layout
    initializeLayout();

    // Initialize header
    const header = new AuthHeader();

    // Get view elements
    const elements = getViewElements();
    if (!elements) {
      throw new Error('Required page elements not found');
    }

    // Hide all views initially
    hideAllViews(elements);

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

    // Initialize appropriate view
    if (shareToken) {
      await initializeSharedView(services, elements, shareToken);
    } else if (changeoverId) {
      await initializeChangeoverView(services, elements, changeoverId);
    } else if (propertyId) {
      await initializePropertyView(services, elements, propertyId);
    } else {
      await initializeHomeView(services, elements);
    }
  } catch (error) {
    console.error('Error initializing views:', error);
    showErrorAlert(error.message || 'Failed to initialize views');
  }
}

async function initializeSharedView(services, elements, token) {
  try {
    const changeover = await services.changeover.getChangeoverByToken(token);
    if (!changeover) throw new Error('Invalid share token');

    elements.findingsView.style.display = 'block';
    elements.changeoverHeader.style.display = 'block';

    new ChangeoverHeader('changeoverHeader', services.changeover, changeover.id);
    const findingsList = new FindingsList('findingsList', services.findings, changeover.id);
    new UploadForm('uploadForm', services.findings, findingsList, changeover.id);
  } catch (error) {
    throw new Error('Failed to load shared changeover');
  }
}

async function initializeChangeoverView(services, elements, changeoverId) {
  if (!authStore.isAuthenticated()) {
    throw new Error('Please sign in to view changeover details');
  }

  elements.findingsView.style.display = 'block';
  elements.changeoverHeader.style.display = 'block';

  new ChangeoverHeader('changeoverHeader', services.changeover, changeoverId);
  const findingsList = new FindingsList('findingsList', services.findings, changeoverId);
  new UploadForm('uploadForm', services.findings, findingsList, changeoverId);
}

async function initializePropertyView(services, elements, propertyId) {
  if (!authStore.isAuthenticated()) {
    throw new Error('Please sign in to view property details');
  }

  elements.propertyDetails.style.display = 'block';
  const propertyDetails = new PropertyDetails('propertyDetails');
  await propertyDetails.initialize(propertyId);
}

async function initializeHomeView(services, elements) {
  elements.propertyList.style.display = 'block';
  elements.changeoverList.style.display = 'block';

  const propertyList = new PropertyList('propertyList', services.changeover);
  const changeoverList = new ChangeoverList('changeoverList', services.changeover);

  propertyList.onPropertySelected((id) => {
    changeoverList.initialize(id);
  });
}