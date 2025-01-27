import { IconService } from '../../services/IconService.js';
import { NotificationSettings } from './NotificationSettings.js';
import { authStore } from '../../auth/AuthStore.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class UserSettings {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.initialize();
  }

  initialize() {
    if (!authStore.isAuthenticated()) {
      this.container.innerHTML = `
        <div class="alert alert-warning">
          Please sign in to access settings.
        </div>
      `;
      return;
    }

    this.render();
    this.initializeComponents();
  }

  render() {
    const user = authStore.currentUser;

    this.container.innerHTML = `
      <div class="mb-4">
        <a href="/" class="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
          ${IconService.createIcon('ArrowLeft', { width: '16', height: '16' })}
          Back to Properties
        </a>
      </div>

      <div class="row g-4">
        <!-- Profile Section -->
        <div class="col-12 col-lg-4">
          <div class="card">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('User')}
              <h3 class="h5 mb-0">Profile</h3>
            </div>
            <div class="card-body">
              <div class="text-center mb-4">
                <div class="avatar mb-3">
                  ${IconService.createIcon('User', { width: '48', height: '48', class: 'text-muted' })}
                </div>
                <h5 class="mb-1">${user.email}</h5>
                <p class="text-muted small mb-0">
                  Member since ${new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>

              <hr>

              <form id="profileForm">
                <div class="mb-3">
                  <label class="form-label d-flex align-items-center gap-2">
                    ${IconService.createIcon('Mail')}
                    Email Address
                  </label>
                  <input type="email" class="form-control" value="${user.email}" readonly>
                </div>

                <div class="mb-3">
                  <label for="currentPassword" class="form-label d-flex align-items-center gap-2">
                    ${IconService.createIcon('Lock')}
                    Current Password
                  </label>
                  <input type="password" class="form-control" id="currentPassword" required>
                </div>

                <div class="mb-3">
                  <label for="newPassword" class="form-label">New Password</label>
                  <input type="password" class="form-control" id="newPassword" required>
                </div>

                <div class="mb-3">
                  <label for="confirmPassword" class="form-label">Confirm New Password</label>
                  <input type="password" class="form-control" id="confirmPassword" required>
                </div>

                <button type="submit" class="btn btn-primary w-100">
                  Update Password
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- Settings Sections -->
        <div class="col-12 col-lg-8">
          <!-- Notification Settings -->
          <div id="notificationSettings" class="mb-4"></div>

          <!-- Danger Zone -->
          <div class="card border-danger">
            <div class="card-header bg-danger bg-opacity-10 d-flex align-items-center gap-2">
              ${IconService.createIcon('AlertTriangle')}
              <h3 class="h5 mb-0">Danger Zone</h3>
            </div>
            <div class="card-body">
              <p class="text-muted mb-4">
                Permanently delete your account and all associated data.
                This action cannot be undone.
              </p>

              <button type="button" class="btn btn-outline-danger" id="deleteAccountBtn">
                ${IconService.createIcon('Trash2')}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initializeComponents() {
    // Initialize notification settings
    new NotificationSettings('notificationSettings');

    // Handle password update
    const profileForm = this.container.querySelector('#profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = profileForm.currentPassword.value;
        const newPassword = profileForm.newPassword.value;
        const confirmPassword = profileForm.confirmPassword.value;

        if (newPassword !== confirmPassword) {
          showErrorAlert('New passwords do not match');
          return;
        }

        try {
          await authStore.updatePassword(currentPassword, newPassword);
          profileForm.reset();
          showErrorAlert('Password updated successfully', 'success');
        } catch (error) {
          showErrorAlert(error.message);
        }
      });
    }

    // Handle account deletion
    const deleteBtn = this.container.querySelector('#deleteAccountBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
          this.handleDeleteAccount();
        }
      });
    }
  }

  async handleDeleteAccount() {
    try {
      await authStore.deleteAccount();
      window.location.href = '/';
    } catch (error) {
      showErrorAlert(error.message);
    }
  }
}