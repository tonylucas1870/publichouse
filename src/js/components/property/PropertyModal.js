import { IconService } from '../../services/IconService.js';

export class PropertyModal {
  static show(onSubmit) {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add New Property</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="propertyForm">
              <div class="mb-3">
                <label for="propertyName" class="form-label d-flex align-items-center gap-2">
                  ${IconService.createIcon('Home')}
                  Property Name
                </label>
                <input type="text" class="form-control" id="propertyName" required>
              </div>
              <div class="mb-3">
                <label for="propertyAddress" class="form-label d-flex align-items-center gap-2">
                  ${IconService.createIcon('MapPin')}
                  Address
                </label>
                <textarea class="form-control" id="propertyAddress" rows="2" required></textarea>
              </div>
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Property</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const closeModal = () => {
      document.body.removeChild(modal);
      document.body.classList.remove('modal-open');
    };

    // Close modal events
    modal.querySelector('.btn-close').addEventListener('click', closeModal);
    modal.querySelector('[data-dismiss="modal"]').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Form submission
    const form = modal.querySelector('#propertyForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        name: form.propertyName.value.trim(),
        address: form.propertyAddress.value.trim()
      };

      try {
        await onSubmit(formData);
        closeModal();
      } catch (error) {
        console.error('Error adding property:', error);
        alert('Failed to add property. Please try again.');
      }
    });
  }
}