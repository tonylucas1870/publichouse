import { ChangeoverHeader } from '../components/changeover/ChangeoverHeader.js';
import { FindingsList } from '../components/findings/FindingsList.js';
import { UploadForm } from '../components/findings/UploadForm.js';
import { AnonymousUserModal } from '../components/auth/AnonymousUserModal.js';
import { showErrorAlert } from '../utils/alertUtils.js';

export async function initializeSharedView({ auth, changeover, findings, anonymous }, elements, shareToken) {
  try {
    console.debug('SharedView: Initializing with token', { shareToken });
    
    // Get changeover by share token
    const changeoverDetails = await changeover.getChangeoverByToken(shareToken);
    if (!changeoverDetails) {
      console.debug('SharedView: No changeover found for token');
      throw new Error('Invalid share token');
    }

    console.debug('SharedView: Found changeover', { 
      changeoverId: changeoverDetails.id,
      propertyName: changeoverDetails.property?.name 
    });

    // Show relevant sections
    elements.findingsView.style.display = 'block';
    elements.changeoverHeader.style.display = 'block';

    // Initialize anonymous user if not authenticated
    if (!auth.isAuthenticated()) {
      console.debug('SharedView: Showing anonymous user modal');
      await AnonymousUserModal.show(anonymous, changeoverDetails.id);
    }

    // Initialize components
    console.debug('SharedView: Initializing components');
    new ChangeoverHeader('changeoverHeader', changeover, changeoverDetails.id);
    const findingsList = new FindingsList('findingsList', findings, changeoverDetails.id);
    new UploadForm('uploadForm', findings, findingsList, changeoverDetails.id);
  } catch (error) {
    console.error('SharedView: Initialization failed', error);
    throw new Error('Failed to load shared changeover');
  }
}