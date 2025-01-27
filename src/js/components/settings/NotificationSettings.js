import { IconService } from '../../services/IconService.js';
import { NotificationService } from '../../services/NotificationService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class NotificationSettings {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.notificationService = new NotificationService();
    this.preferences = [];
    this.initialize();
  }

  async initialize() {
    try {
      this.preferences = await this.notificationService.getPreferences();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      this.showError(error.message);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header bg-transparent d-flex align-items-center gap-2">
          ${IconService.createIcon('Bell')}
          <h3 class="h5 mb-0">Email Notifications</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4">
            Choose which notifications you'd like to receive via email.
          </p>
          
          <div class="list-group list-group-flush">
            ${this.preferences.map(pref => `
              <div class="list-group-item px-0">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" 
                         id="pref-${pref.notification_type}"
                         data-type="${pref.notification_type}"
                         ${pref.enabled ? 'checked' : ''}>
                  <label class="form-check-label" for="pref-${pref.notification_type}">
                    ${this.getNotificationLabel(pref.notification_type)}
                  </label>
                </div>
                <small class="text-muted d-block mt-1">
                  ${this.getNotificationDescription(pref.notification_type)}
                </small>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  getNotificationLabel(type) {
    const labels = {
      changeover_created: 'New Changeovers',
      changeover_status_changed: 'Changeover Status Updates',
      finding_created: 'New Findings',
      finding_status_changed: 'Finding Status Updates',
      finding_comment_added: 'New Comments',
      finding_media_added: 'New Media Added'
    };
    return labels[type] || type;
  }

  getNotificationDescription(type) {
    const descriptions = {
      changeover_created: 'When a new changeover is scheduled for your properties',
      changeover_status_changed: 'When the status of a changeover is updated',
      finding_created: 'When a new finding is reported at your properties',
      finding_status_changed: 'When the status of a finding is updated',
      finding_comment_added: 'When someone comments on a finding',
      finding_media_added: 'When new photos or videos are added to a finding'
    };
    return descriptions[type] || '';
  }

  attachEventListeners() {
    this.container.querySelectorAll('.form-check-input').forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        const type = checkbox.dataset.type;
        const enabled = checkbox.checked;
        
        try {
          await this.notificationService.updatePreference(type, enabled);
          showErrorAlert('Notification settings updated', 'success');
        } catch (error) {
          console.error('Error updating notification preference:', error);
          checkbox.checked = !enabled; // Revert checkbox
          showErrorAlert(error.message);
        }
      });
    });
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        ${message || 'Failed to load notification settings'}
      </div>
    `;
  }
}