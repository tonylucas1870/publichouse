import { ChangeoverHeader } from '../components/changeover/ChangeoverHeader.js';
import { FindingsList } from '../components/findings/FindingsList.js';
import { UploadForm } from '../components/findings/UploadForm.js';
import { AnonymousUserModal } from '../components/auth/AnonymousUserModal.js';
import { AnonymousUserService } from '../services/AnonymousUserService.js';
import { showErrorAlert } from '../utils/alertUtils.js';

export async function initializeChangeoverView({ auth, changeover, findings, anonymous }, elements, changeoverId) {
  try {
    if (!changeoverId) {
      throw new Error('Changeover ID is required');
    }

    // Get changeover details first
    const changeoverDetails = await changeover.getChangeover(changeoverId);
    if (!changeoverDetails) {
      throw new Error('Changeover not found');
    }

    // Show the relevant sections
    elements.findingsView.style.display = 'block';
    elements.changeoverHeader.style.display = 'block';

    console.debug(auth.isAuthenticated())
    // Initialize anonymous user if not authenticated
    if (!auth.isAuthenticated()) {
      await AnonymousUserModal.show(anonymous, changeoverId);
    }

    // Initialize components
    const header = new ChangeoverHeader('changeoverHeader', changeover, changeoverId);
    const findingsList = new FindingsList('findingsList', findings, changeoverId);
    const uploadForm = new UploadForm('uploadForm', findings, findingsList, changeoverId);

    return { header, findingsList, uploadForm };
  } catch (error) {
    console.error('Error initializing changeover view:', error);
    showErrorAlert(error.message || 'Failed to load changeover details');
    throw error;
  }
}