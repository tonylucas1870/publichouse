import { IconService } from '../../services/IconService.js';
import { NotificationService } from '../../services/NotificationService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { validateForm } from '../../utils/formUtils.js';

export class UserSettings {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.notificationService = new NotificationService();
    this.initialize();
  }

  async initialize() {
    try {
      const preferences = await this.notificationService.getPreferences();
      this.preferences = preferences;
      this.render(preferences);
      this.attachEventListeners();
    } catch (error) {
      console.error('Error initializing user settings:', error);
      this.showError(error.message);
    }
  }

  render(preferences) {
    this.container.innerHTML = `
      <div class="row g-4">
        <!-- Display Name -->
        <div class="col-12 col-lg-6">
          <div class="card">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('User')}
              <h3 class="h5 mb-0">Display Name</h3>
            </div>
            <div class="card-body">
              <form id="displayNameForm">
                <div class="mb-3">
                  <label for="displayName" class="form-label">Display Name (Optional)</label>
                  <input type="text" class="form-control" id="displayName" 
                         value="${preferences.display_name || ''}"
                         placeholder="Enter a display name">
                  <div class="form-text">
                    This name will be shown instead of your email address when you add notes or comments.
                  </div>
                </div>
                <button type="submit" class="btn btn-primary">
                  Save Display Name
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- Anonymous User Upgrade -->
        ${this.anonymousUserService?.isAnonymous() ? `
          <div class="col-12">
            ${AnonymousUpgradeForm.render(this.anonymousUserService)}
          </div>
        ` : ''}

        <!-- Notification Preferences -->
        <div class="col-12 col-lg-6">
          <div class="card">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('Bell')}
              <h3 class="h5 mb-0">Notification Preferences</h3>
            </div>
            <div class="card-body">
              <form id="notificationForm">
                <div class="mb-4">
                  <h6 class="mb-3">Changeovers</h6>
                  <div class="form-check mb-2">
                    <input type="checkbox" class="form-check-input" id="changeover_created"
                           ${this.isEnabled(preferences, 'changeover_created') ? 'checked' : ''}>
                    <label class="form-check-label" for="changeover_created">
                      New changeovers
                    </label>
                  </div>
                  <div class="form-check mb-2">
                    <input type="checkbox" class="form-check-input" id="changeover_status_changed"
                           ${this.isEnabled(preferences, 'changeover_status_changed') ? 'checked' : ''}>
                    <label class="form-check-label" for="changeover_status_changed">
                      Status changes
                    </label>
                  </div>
                </div>

                <div class="mb-4">
                  <h6 class="mb-3">Findings</h6>
                  <div class="form-check mb-2">
                    <input type="checkbox" class="form-check-input" id="finding_created"
                           ${this.isEnabled(preferences, 'finding_created') ? 'checked' : ''}>
                    <label class="form-check-label" for="finding_created">
                      New findings
                    </label>
                  </div>
                  <div class="form-check mb-2">
                    <input type="checkbox" class="form-check-input" id="finding_status_changed"
                           ${this.isEnabled(preferences, 'finding_status_changed') ? 'checked' : ''}>
                    <label class="form-check-label" for="finding_status_changed">
                      Status changes
                    </label>
                  </div>
                  <div class="form-check mb-2">
                    <input type="checkbox" class="form-check-input" id="finding_comment_added"
                           ${this.isEnabled(preferences, 'finding_comment_added') ? 'checked' : ''}>
                    <label class="form-check-label" for="finding_comment_added">
                      New comments
                    </label>
                  </div>
                  <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="finding_media_added"
                           ${this.isEnabled(preferences, 'finding_media_added') ? 'checked' : ''}>
                    <label class="form-check-label" for="finding_media_added">
                      New media
                    </label>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Password Change -->
        <div class="col-12 col-lg-6">
          <div class="card">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('Lock')}
              <h3 class="h5 mb-0">Change Password</h3>
            </div>
            <div class="card-body">
              <form id="passwordForm" class="needs-validation" novalidate>
                <div class="mb-3">
                  <label for="currentPassword" class="form-label">Current Password</label>
                  <input type="password" class="form-control" id="currentPassword" required>
                  <div class="invalid-feedback">
                    Please enter your current password
                  </div>
                </div>

                <div class="mb-3">
                  <label for="newPassword" class="form-label">New Password</label>
                  <input type="password" class="form-control" id="newPassword" required
                         minlength="6" pattern="^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{6,}$">
                  <div class="invalid-feedback">
                    Password must be at least 6 characters and contain both letters and numbers
                  </div>
                </div>

                <div class="mb-4">
                  <label for="confirmPassword" class="form-label">Confirm New Password</label>
                  <input type="password" class="form-control" id="confirmPassword" required>
                  <div class="invalid-feedback">
                    Passwords must match
                  </div>
                </div>

                <button type="submit" class="btn btn-primary">
                  Change Password
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  isEnabled(preferences, type) {
    return preferences?.notification_preferences?.[type] ?? true; // Default to enabled if no preference set
  }

  attachEventListeners() {
    // Display name form
    const displayNameForm = this.container.querySelector('#displayNameForm');
    if (displayNameForm) {
      displayNameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
          await this.notificationService.updateDisplayName(
            displayNameForm.displayName.value.trim()
          );
          showErrorAlert('Display name updated successfully', 'success');
        } catch (error) {
          console.error('Error updating display name:', error);
          showErrorAlert(error.message);
        }
      });
    }

    // Anonymous user upgrade
    if (this.anonymousUserService?.isAnonymous()) {
      AnonymousUpgradeForm.attachEventListeners(this.container, this.anonymousUserService);
    }

    // Notification preferences
    const checkboxes = this.container.querySelectorAll('.form-check-input');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        try {
          await this.notificationService.updatePreference(
            checkbox.id,
            checkbox.checked
          );
          showErrorAlert('Preferences updated', 'success');
        } catch (error) {
          console.error('Error updating preference:', error);
          checkbox.checked = !checkbox.checked; // Revert change
          showErrorAlert(error.message);
        }
      });
    });

    // Password change
    const passwordForm = this.container.querySelector('#passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Custom validation rules
        const rules = {
          confirmPassword: (value) => {
            if (value !== passwordForm.newPassword.value) {
              return 'Passwords must match';
            }
            return null;
          }
        };

        const { isValid } = validateForm(passwordForm, rules);
        if (!isValid) return;

        try {
          await this.notificationService.updatePassword(
            passwordForm.currentPassword.value,
            passwordForm.newPassword.value
          );
          
          showErrorAlert('Password updated successfully', 'success');
          passwordForm.reset();
        } catch (error) {
          console.error('Error updating password:', error);
          showErrorAlert(error.message);
        }
      });
    }
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        ${message || 'Failed to load user settings'}
      </div>
    `;
  }
}