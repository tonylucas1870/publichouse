import { IconService } from '../../services/IconService.js';
import { Modal } from '../ui/Modal.js';
import { validateForm } from '../../utils/formUtils.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class AnonymousUserModal {
  static async show(anonymousUserService, changeoverId) {
    console.debug('AnonymousUserModal: Showing modal', {
      hasAnonymousService: !!anonymousUserService,
      changeoverId,
      existingName: anonymousUserService.getName()
    });

    // Don't show if user already identified
    if (anonymousUserService.getName()) {
      console.debug('AnonymousUserModal: User already identified, skipping modal');
      return;
    }

    const { modal, closeModal } = Modal.show({
      title: 'Welcome!',
      content: `
        <form id="anonymousUserForm">
          <p class="text-muted mb-4">
            Please enter your name so we can identify you if you return later.
          </p>
          <div class="mb-3">
            <label for="name" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('User')}
              Your Name
            </label>
            <input type="text" class="form-control" id="name" required>
            <div class="invalid-feedback">
              Please enter your name
            </div>
          </div>
          <div class="d-flex justify-content-end gap-2">
            <button type="submit" class="btn btn-primary">
              Continue
            </button>
          </div>
        </form>
      `
    });

    // Form submission
    const form = modal.querySelector('#anonymousUserForm');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      console.debug('AnonymousUserModal: Form submitted');
      const { isValid } = validateForm(form);
      console.debug('AnonymousUserModal: Form validation result', { isValid });

      if (!isValid) return;

      try {
        const name = form.name.value.trim();
        console.debug('AnonymousUserModal: Creating anonymous user', {
          name,
          changeoverId
        });

        await anonymousUserService.getOrCreateUser(
          name,
          changeoverId
        );
        console.debug('AnonymousUserModal: Anonymous user created successfully');
        closeModal();
      } catch (error) {
        console.error('AnonymousUserModal: Error creating user', error);
        showErrorAlert(error.message);
      }
    });
  }
}