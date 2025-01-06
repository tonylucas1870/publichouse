import { IconService } from '../../services/IconService.js';
import { CleanerService } from '../../services/CleanerService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { Modal } from '../ui/Modal.js';

export class CleanersList {
  constructor(containerId, propertyId) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    this.cleanerService = new CleanerService();
    this.cleaners = [];
    this.initialize();
  }

  async initialize() {
    try {
      this.cleaners = await this.cleanerService.getCleaners(this.propertyId);
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading cleaners:', error);
      this.showError();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header bg-transparent d-flex align-items-center gap-2">
          ${IconService.createIcon('Users')}
          <h3 class="h5 mb-0">Cleaners</h3>
        </div>
        <div class="card-body">
          ${this.renderCleanersList()}
          <button class="btn btn-outline-primary btn-sm mt-3" id="addCleanerBtn">
            ${IconService.createIcon('Plus')}
            Add Cleaner
          </button>
        </div>
      </div>
    `;
  }

  renderCleanersList() {
    if (!this.cleaners.length) {
      return `
        <div class="alert alert-info mb-0">
          No cleaners assigned yet.
        </div>
      `;
    }

    return `
      <div class="list-group list-group-flush">
        ${this.cleaners.map(cleaner => `
          <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              ${IconService.createIcon('User')}
              <span class="ms-2">${cleaner.user_email}</span>
            </div>
            <button class="btn btn-outline-danger btn-sm remove-cleaner" 
                    data-cleaner-id="${cleaner.id}">
              ${IconService.createIcon('Trash2')}
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  attachEventListeners() {
    const addBtn = this.container.querySelector('#addCleanerBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.showAddCleanerModal());
    }

    this.container.querySelectorAll('.remove-cleaner').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const cleanerId = e.currentTarget.dataset.cleanerId;
        await this.handleRemoveCleaner(cleanerId);
      });
    });
  }

  showAddCleanerModal() {
    const { modal, closeModal } = Modal.show({
      title: 'Add Cleaner',
      content: `
        <form id="addCleanerForm">
          <div class="mb-3">
            <label for="cleanerEmail" class="form-label">Cleaner's Email</label>
            <input type="email" class="form-control" id="cleanerEmail" required>
          </div>
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Cleaner</button>
          </div>
        </form>
      `
    });

    const form = modal.querySelector('#addCleanerForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await this.cleanerService.addCleaner(
          this.propertyId,
          form.cleanerEmail.value.trim()
        );
        await this.initialize();
        closeModal();
        showErrorAlert('Cleaner added successfully', 'success');
      } catch (error) {
        showErrorAlert(error.message);
      }
    });
  }

  async handleRemoveCleaner(cleanerId) {
    if (!confirm('Are you sure you want to remove this cleaner?')) return;

    try {
      await this.cleanerService.removeCleaner(cleanerId);
      await this.initialize();
      showErrorAlert('Cleaner removed successfully', 'success');
    } catch (error) {
      showErrorAlert(error.message);
    }
  }

  showError() {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        Failed to load cleaners. Please try again later.
      </div>
    `;
  }
}