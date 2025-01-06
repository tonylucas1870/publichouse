import { ChangeoverHeader } from '../components/changeover/ChangeoverHeader.js';
import { FindingsList } from '../components/findings/FindingsList.js';
import { UploadForm } from '../components/findings/UploadForm.js';
import { showErrorAlert } from '../utils/alertUtils.js';

export async function initializeChangeoverView(services, elements, changeoverId) {
  try {
    if (!changeoverId) {
      throw new Error('Changeover ID is required');
    }

    // Get changeover details first
    const changeover = await services.changeover.getChangeover(changeoverId);
    if (!changeover) {
      throw new Error('Changeover not found');
    }

    // Show the relevant sections
    elements.findingsView.style.display = 'block';
    elements.changeoverHeader.style.display = 'block';

    // Initialize components
    const header = new ChangeoverHeader('changeoverHeader', services.changeover, changeoverId);
    const findingsList = new FindingsList('findingsList', services.findings, changeoverId);
    const uploadForm = new UploadForm('uploadForm', services.findings, findingsList, changeoverId);

    return { header, findingsList, uploadForm };
  } catch (error) {
    console.error('Error initializing changeover view:', error);
    showErrorAlert(error.message || 'Failed to load changeover details');
    throw error;
  }
}