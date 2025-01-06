import { IconService } from '../../services/IconService.js';
import { PropertyAccessService } from '../../services/PropertyAccessService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { Modal } from '../ui/Modal.js';

export class PropertyAccess {
  constructor(containerId, propertyId, isAdmin) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    this.isAdmin = isAdmin;
    this.accessService = new PropertyAccessService();
    this.accessList = [];
    this.initialize();
  }

  async initialize() {
    try {
      await this.loadAccessList();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error initializing property access:', error);
      this.showError(error.message);
    }
  }

  async loadAccessList() {
    this.accessList = await this.accessService.getPropertyAccess(this.propertyId);
  }

  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
          ${IconService.createIcon('Users')}
          <h3 class="h5 mb-0">Property Access</h3>
          </div>
          ${this.isAdmin ? `
            <button class="btn btn-outline-primary btn-sm" id="addAccessBtn">
              ${IconService.createIcon('Plus')}
              Add User Access
            </button>
          ` : ''}
        </div>
        <div class="card-body">
          ${this.renderAccessList()}
        </div>
      </div>
    `;
  }

  renderAccessList() {
    if (!this.accessList.length) {
      return `
        <div class="alert alert-info mb-0">
          No additional users have access to this property.
        </div>
      `;
    }

    return `
      <div class="list-group list-group-flush">
        ${this.accessList.map(access => `
          <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <div class="d-flex align-items-center gap-2">
                ${IconService.createIcon('User')}
                <span>${access.user_email || 'Unknown User'}</span>
              </div>
              <small class="text-muted d-flex align-items-center gap-1 mt-1">
                ${IconService.createIcon('Shield', { width: '14', height: '14' })}
                ${this.getAccessLevelLabel(access.access_level)}
              </small>
            </div>
            ${this.isAdmin ? `
            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary btn-sm edit-access"
                      data-user-email="${access.user_email}"
                      data-access-level="${access.access_level}">
                ${IconService.createIcon('Edit')}
              </button>
              <button class="btn btn-outline-danger btn-sm remove-access"
                      data-user-email="${access.user_email}">
                ${IconService.createIcon('Trash2')}
              </button>
            </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  getAccessLevelLabel(level) {
    const labels = {
      cleaner: 'Cleaner Access',
      maintenance: 'Maintenance Access',
      admin: 'Admin Access'
    };
    return labels[level] || level;
  }

  attachEventListeners() {
    const addBtn = this.container.querySelector('#addAccessBtn');
    if (addBtn && this.isAdmin) {
      addBtn.addEventListener('click', () => this.showAccessModal());
    }

    this.container.querySelectorAll('.edit-access').forEach(btn => {
      btn.addEventListener('click', () => {
        const { userEmail, accessLevel } = btn.dataset;
        if (this.isAdmin) {
          this.showAccessModal(userEmail, accessLevel);
        }
      });
    });

    this.container.querySelectorAll('.remove-access').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { userEmail } = btn.dataset;
        if (this.isAdmin && confirm(`Remove access for ${userEmail}?`)) {
          await this.handleRemoveAccess(userEmail);
        }
      });
    });
  }

  showAccessModal(userEmail = '', currentLevel = '') {
    const { modal, closeModal } = Modal.show({
      title: userEmail ? 'Edit Access' : 'Add User Access',
      content: `
        <form id="accessForm">
          <div class="mb-3">
            <label for="userEmail" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Mail')}
              User Email
            </label>
            <input type="email" 
                   class="form-control" 
                   id="userEmail" 
                   value="${userEmail}"
                   ${userEmail ? 'readonly' : 'required'}>
          </div>
          <div class="mb-3">
            <label for="accessLevel" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Shield')}
              Access Level
            </label>
            <select class="form-select" id="accessLevel" required>
              <option value="cleaner" ${currentLevel === 'cleaner' ? 'selected' : ''}>
                Cleaner Access
              </option>
              <option value="maintenance" ${currentLevel === 'maintenance' ? 'selected' : ''}>
                Maintenance Access
              </option>
              <option value="admin" ${currentLevel === 'admin' ? 'selected' : ''}>
                Admin Access
              </option>
            </select>
          </div>
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              ${userEmail ? 'Update Access' : 'Add Access'}
            </button>
          </div>
        </form>
      `
    });

    const form = modal.querySelector('#accessForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await this.accessService.manageAccess(
          this.propertyId,
          form.userEmail.value.trim(),
          form.accessLevel.value
        );
        await this.loadAccessList();
        this.render();
        this.attachEventListeners();
        closeModal();
        showErrorAlert('Access updated successfully', 'success');
      } catch (error) {
        showErrorAlert(error.message);
      }
    });
  }

  async handleRemoveAccess(userEmail) {
    try {
      await this.accessService.removeAccess(this.propertyId, userEmail);
      await this.loadAccessList();
      this.render();
      this.attachEventListeners();
      showErrorAlert('Access removed successfully', 'success');
    } catch (error) {
      showErrorAlert(error.message);
    }
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        ${message || 'Failed to load property access. Please try again later.'}
      </div>
    `;
  }
}