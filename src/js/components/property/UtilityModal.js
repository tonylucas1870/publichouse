import { IconService } from '../../services/IconService.js';
import { Modal } from '../ui/Modal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class UtilityModal {
  static show(utility, utilityService) {
    const { modal, closeModal } = Modal.show({
      title: utility ? 'Edit Utility' : 'Add Utility',
      content: `
        <form id="utilityForm">
          <div class="mb-3">
            <label for="utilityType" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Zap')}
              Type
            </label>
            <select class="form-select" id="utilityType" required>
              <option value="">Select utility type...</option>
              <option value="electricity" ${utility?.type === 'electricity' ? 'selected' : ''}>Electricity</option>
              <option value="gas" ${utility?.type === 'gas' ? 'selected' : ''}>Gas</option>
              <option value="water" ${utility?.type === 'water' ? 'selected' : ''}>Water</option>
              <option value="internet" ${utility?.type === 'internet' ? 'selected' : ''}>Internet</option>
              <option value="other" ${utility?.type === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>

          <div class="mb-3">
            <label for="provider" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Building')}
              Provider
            </label>
            <input 
              type="text" 
              class="form-control" 
              id="provider" 
              value="${utility?.provider || ''}"
              required
            >
          </div>

          <div class="mb-3">
            <label for="accountNumber" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Hash')}
              Account Number
            </label>
            <input 
              type="text" 
              class="form-control" 
              id="accountNumber"
              value="${utility?.account_number || ''}"
            >
          </div>

          <div class="mb-4">
            <label for="notes" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('FileText')}
              Notes
            </label>
            <textarea 
              class="form-control" 
              id="notes" 
              rows="3"
            >${utility?.notes || ''}</textarea>
          </div>

          <div class="d-flex justify-content-between">
            ${utility ? `
              <button type="button" class="btn btn-outline-danger" id="deleteUtilityBtn">
                ${IconService.createIcon('Trash2')}
                Delete
              </button>
            ` : `
              <div></div>
            `}
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">
                ${utility ? 'Save Changes' : 'Add Utility'}
              </button>
            </div>
          </div>
        </form>
      `
    });

    const form = modal.querySelector('#utilityForm');
    const deleteBtn = modal.querySelector('#deleteUtilityBtn');

    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        type: form.utilityType.value,
        provider: form.provider.value.trim(),
        account_number: form.accountNumber.value.trim(),
        notes: form.notes.value.trim()
      };

      try {
        if (utility) {
          await utilityService.updateUtility(utility.id, formData);
          showErrorAlert('Utility updated successfully', 'success');
        } else {
          await utilityService.addUtility(formData);
          showErrorAlert('Utility added successfully', 'success');
        }
        closeModal();
        window.location.reload(); // Refresh to show changes
      } catch (error) {
        showErrorAlert(error.message || 'Failed to save utility');
      }
    });

    // Handle delete
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this utility?')) {
          try {
            await utilityService.deleteUtility(utility.id);
            showErrorAlert('Utility deleted successfully', 'success');
            closeModal();
            window.location.reload(); // Refresh to show changes
          } catch (error) {
            showErrorAlert(error.message || 'Failed to delete utility');
          }
        }
      });
    }
  }
}