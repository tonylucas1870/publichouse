import { IconService } from '../../services/IconService.js';
import { validateForm } from '../../utils/formUtils.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class AnonymousUpgradeForm {
  static render(anonymousUserService) {
    return `
      <div class="card">
        <div class="card-header bg-transparent d-flex align-items-center gap-2">
          ${IconService.createIcon('UserPlus')}
          <h3 class="h5 mb-0">Create Account</h3>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4">
            Create an account to keep track of your findings and access more features.
          </p>
          <form id="upgradeForm">
            <div class="mb-3">
              <label for="email" class="form-label d-flex align-items-center gap-2">
                ${IconService.createIcon('Mail')}
                Email Address
              </label>
              <input type="email" class="form-control" id="email" required>
              <div class="invalid-feedback">
                Please enter a valid email address
              </div>
            </div>
            <div class="mb-4">
              <label for="password" class="form-label d-flex align-items-center gap-2">
                ${IconService.createIcon('Lock')}
                Password
              </label>
              <input type="password" class="form-control" id="password" required 
                     minlength="6" pattern="^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{6,}$">
              <div class="invalid-feedback">
                Password must be at least 6 characters and contain both letters and numbers
              </div>
            </div>
            <button type="submit" class="btn btn-primary">
              Create Account
            </button>
          </form>
        </div>
      </div>
    `;
  }

  static attachEventListeners(container, anonymousUserService) {
    const form = container.querySelector('#upgradeForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const { isValid } = validateForm(form);
      if (!isValid) return;

      try {
        await anonymousUserService.convertToFullAccount(
          form.email.value.trim(),
          form.password.value
        );
        showErrorAlert('Account created successfully! You are now signed in.', 'success');
        window.location.reload();
      } catch (error) {
        showErrorAlert(error.message);
      }
    });
  }
}