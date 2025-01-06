import { PropertyList } from '../components/property/PropertyList.js';
import { ChangeoverList } from '../components/changeover/ChangeoverList.js';
import { PendingFindingsList } from '../components/findings/PendingFindingsList.js';
import { showErrorAlert } from '../utils/alertUtils.js';

export async function initializeHomeView(services, elements) {
  try {
    // Show required sections
    elements.propertyList.style.display = 'block';
    elements.changeoverList.style.display = 'block';
    elements.pendingFindingsList.style.display = 'block';

    // Initialize components
    const propertyList = new PropertyList(
      'propertyList', 
      services.property
    );
    
    const changeoverList = new ChangeoverList(
      'changeoverList', 
      services.changeover
    );

    const pendingFindingsList = new PendingFindingsList(
      'pendingFindingsList',
      services.findings
    );

    // Set up property selection handler
    propertyList.onPropertySelected((propertyIds) => {
      changeoverList.initialize(propertyIds);
      pendingFindingsList.setSelectedProperty(propertyIds?.[0] || null);
    });

    return { propertyList, changeoverList, pendingFindingsList };
  } catch (error) {
    console.error('Error initializing home view:', error);
    showErrorAlert(error.message || 'Failed to initialize home view');
    throw error;
  }
}