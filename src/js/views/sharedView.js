import { ChangeoverHeader } from '../components/changeover/ChangeoverHeader.js';
import { FindingsList } from '../components/findings/FindingsList.js';
import { UploadForm } from '../components/findings/UploadForm.js';

export async function initializeSharedView(services, elements, token) {
  try {
    console.debug('SharedView: Initializing with token', { token });
    const changeover = await services.changeover.getChangeoverByToken(token);
    if (!changeover) {
      console.debug('SharedView: No changeover found for token');
      throw new Error('Invalid share token');
    }
    console.debug('SharedView: Found changeover', { 
      changeoverId: changeover.id,
      propertyName: changeover.property?.name 
    });

    elements.findingsView.style.display = 'block';
    elements.changeoverHeader.style.display = 'block';

    console.debug('SharedView: Initializing components');
    new ChangeoverHeader('changeoverHeader', services.changeover, changeover.id);
    const findingsList = new FindingsList('findingsList', services.findings, changeover.id);
    new UploadForm('uploadForm', services.findings, findingsList, changeover.id);
  } catch (error) {
    console.error('SharedView: Initialization failed', error);
    throw new Error('Failed to load shared changeover');
  }
}