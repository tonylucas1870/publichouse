import { Modal } from '../ui/Modal.js';
import { IconService } from '../../services/IconService.js';
import { authStore } from '../../auth/AuthStore.js';
import { validateForm, resetForm } from '../../utils/formUtils.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class AuthModal {
  static show(mode = 'signin') {
    const { modal, closeModal } = Modal.show({
      title: mode === 'signin' ? 'Sign In' : 'Sign Up',
      content: `
        <form id="authForm">
          <div class="mb-3">
            <label for="email" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Mail')}
              Email
            </label>
            <input type="email" class="form-control" id="email" name="email" required>
          </div>
          <div class="mb-3">
            <label for="password" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Lock')}
              Password
            </label>
            <input type="password" class="form-control" id="password" name="password" required>
          </div>
          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">
              ${mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>
      `
    });

    // Form submission
    const form = modal.querySelector('#authForm');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const { isValid } = validateForm(form);
      if (!isValid) return;

      const formData = {
        email: form.email.value.trim(),
        password: form.password.value
      };

      try {
        if (mode === 'signin') {
          await authStore.signIn(formData.email, formData.password);
        } else {
          await authStore.signUp(formData.email, formData.password);
        }
        closeModal();
      } catch (error) {
        showErrorAlert(error.message);
      }
    });

    // Close modal on cancel
    modal.querySelector('[data-dismiss="modal"]')?.addEventListener('click', closeModal);
  }
}