import { IconService } from '../../services/IconService.js';
import { UtilityService } from '../../services/UtilityService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class PropertyUtilities {
  constructor(containerId, propertyId) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    this.utilityService = new UtilityService();
    this.utilities = [];
    this.initialize();
  }

  async initialize() {
    try {
      this.utilities = await this.utilityService.getUtilities(this.propertyId);
      const isAdmin = this.container.dataset.isAdmin === 'true';
      console.debug('PropertyUtilities: Initializing', {
        propertyId: this.propertyId,
        isAdmin,
        utilitiesCount: this.utilities.length
      });
      this.isAdmin = isAdmin;
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading utilities:', error);
      this.showError();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="h5 mb-0">Utilities</h4>
        ${this.isAdmin ? `
        <button class="btn btn-outline-primary btn-sm" id="addUtilityBtn">
          ${IconService.createIcon('Plus')} Add Utility
        </button>
        ` : ''}
      </div>

      ${this.utilities.length === 0 ? `
        <p class="text-muted">No utilities added yet.</p>
      ` : `
        <div class="list-group">
          ${this.utilities.map(utility => this.renderUtility(utility)).join('')}
        </div>
      `}

      <!-- Add Utility Modal -->
      <div class="modal" id="addUtilityModal" tabindex="-1" style="display: none;">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Add Utility</h5>
              <button type="button" class="btn-close" data-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="addUtilityForm">
                <div class="mb-3">
                  <label for="utilityType" class="form-label">Type</label>
                  <select class="form-select" id="utilityType" required>
                    <option value="">Select utility type...</option>
                    <option value="electricity">Electricity</option>
                    <option value="gas">Gas</option>
                    <option value="water">Water</option>
                    <option value="internet">Internet</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label for="provider" class="form-label">Provider</label>
                  <input type="text" class="form-control" id="provider" required>
                </div>
                <div class="mb-3">
                  <label for="accountNumber" class="form-label">Account Number</label>
                  <input type="text" class="form-control" id="accountNumber">
                </div>
                <div class="mb-3">
                  <label for="notes" class="form-label">Notes</label>
                  <textarea class="form-control" id="notes" rows="2"></textarea>
                </div>
                <div class="d-flex justify-content-end gap-2">
                  <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                  <button type="submit" class="btn btn-primary">Add Utility</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderUtility(utility) {
    const isAdmin = this.container.dataset.isAdmin === 'true';
    return `
      <div class="list-group-item">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="mb-1">${utility.type}</h6>
            <p class="mb-1">Provider: ${utility.provider}</p>
            ${utility.accountNumber ? `
              <p class="mb-1 text-muted">Account: ${utility.accountNumber}</p>
            ` : ''}
            ${utility.notes ? `
              <p class="mb-0 text-muted"><small>${utility.notes}</small></p>
            ` : ''}
          </div>
          ${isAdmin ? `
            <button class="btn btn-outline-danger btn-sm delete-utility" 
                    data-utility-id="${utility.id}">
              ${IconService.createIcon('Trash2')}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const isAdmin = this.container.dataset.isAdmin === 'true';
    
    // Add Utility button
    const addUtilityBtn = this.container.querySelector('#addUtilityBtn');
    if (addUtilityBtn && isAdmin) {
      addUtilityBtn.addEventListener('click', () => this.showAddUtilityModal());
    }

    // Delete Utility buttons
    if (isAdmin) {
      this.container.querySelectorAll('.delete-utility').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const utilityId = e.target.closest('.delete-utility').dataset.utilityId;
          this.handleDeleteUtility(utilityId);
        });
      });
    }

    // Modal form submission
    const form = this.container.querySelector('#addUtilityForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddUtility(e));
    }

    // Modal close buttons
    this.container.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
      btn.addEventListener('click', () => this.hideAddUtilityModal());
    });
  }

  showAddUtilityModal() {
    const modal = this.container.querySelector('#addUtilityModal');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
  }

  hideAddUtilityModal() {
    const modal = this.container.querySelector('#addUtilityModal');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    // Reset form
    modal.querySelector('form').reset();
  }

  async handleAddUtility(e) {
    e.preventDefault();
    const form = e.target;
    const utilityData = {
      type: form.utilityType.value,
      provider: form.provider.value.trim(),
      accountNumber: form.accountNumber.value.trim(),
      notes: form.notes.value.trim(),
      propertyId: this.propertyId
    };

    try {
      const newUtility = await this.utilityService.addUtility(utilityData);
      this.utilities.push(newUtility);
      this.hideAddUtilityModal();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error adding utility:', error);
      showErrorAlert('Failed to add utility');
    }
  }

  async handleDeleteUtility(utilityId) {
    if (confirm('Are you sure you want to delete this utility?')) {
      try {
        await this.utilityService.deleteUtility(utilityId);
        this.utilities = this.utilities.filter(u => u.id !== utilityId);
        this.render();
        this.attachEventListeners();
      } catch (error) {
        console.error('Error deleting utility:', error);
        showErrorAlert('Failed to delete utility');
      }
    }
  }

  showError() {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        Failed to load utilities. Please try again later.
      </div>
    `;
  }
}