import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { Navigation } from '../ui/Navigation.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { authStore } from '../../auth/AuthStore.js';

export class ChangeoverHeader {
  constructor(containerId, changeoverService, changeoverId) {
    this.container = document.getElementById(containerId);
    this.changeoverService = changeoverService;
    this.changeoverId = changeoverId;
    this.initialize();
  }

  async initialize() {
    try {
      const changeover = await this.changeoverService.getChangeover(this.changeoverId);
      if (!changeover) {
        throw new Error('Changeover not found');
      }
      this.render(changeover);
    } catch (error) {
      console.error('Error loading changeover:', error);
      this.showError();
    }
  }

  render(changeover) {
    this.container.innerHTML = `
      <div class="mb-4">
        ${Navigation.renderBackButton()}
        <div class="d-flex justify-content-between align-items-start mt-3">
          <div>
            <h2 class="h4 mb-2">${changeover.property?.name || 'Loading...'}</h2>
            <p class="text-muted d-flex align-items-center gap-2">
              ${IconService.createIcon('Calendar')}
              Check-in: ${formatDate(changeover.checkin_date)} | 
              Check-out: ${formatDate(changeover.checkout_date)}
            </p>
          </div>
          ${authStore.isAuthenticated() ? `
            <div class="d-flex align-items-center gap-2">
              <select class="form-select form-select-sm" id="changeoverStatus">
                <option value="scheduled" ${changeover.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                <option value="in_progress" ${changeover.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="complete" ${changeover.status === 'complete' ? 'selected' : ''}>Complete</option>
              </select>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Attach status change handler
    const statusSelect = this.container.querySelector('#changeoverStatus');
    if (statusSelect) {
      statusSelect.addEventListener('change', async () => {
        try {
          await this.changeoverService.updateStatus(this.changeoverId, statusSelect.value);
          showErrorAlert('Status updated successfully', 'success');
        } catch (error) {
          console.error('Error updating status:', error);
          showErrorAlert(error.message);
          // Reset select to previous value
          statusSelect.value = changeover.status;
        }
      });
    }
  }

  showError() {
    this.container.innerHTML = `
      <div class="mb-4">
        ${Navigation.renderBackButton()}
        <div class="alert alert-danger mt-3">
          Failed to load changeover details.
        </div>
      </div>
    `;
  }
}