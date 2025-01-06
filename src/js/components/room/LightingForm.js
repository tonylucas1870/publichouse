import { IconService } from '../../services/IconService.js';

export class LightingForm {
  static render(lighting = {}) {
    return `
      <div class="lighting-form mb-3">
        <div class="row g-3">
          <div class="col-md-6">
            <input type="text" 
                   class="form-control lighting-location" 
                   placeholder="Location (e.g., Ceiling, Corner)"
                   value="${lighting.location || ''}"
                   required>
          </div>
          <div class="col-md-6">
            <input type="text" 
                   class="form-control lighting-fixture" 
                   placeholder="Fixture type"
                   value="${lighting.fixture || ''}"
                   required>
          </div>
          <div class="col-12">
            <textarea class="form-control lighting-notes" 
                      placeholder="Additional notes"
                      rows="2">${lighting.notes || ''}</textarea>
          </div>
        </div>
        <div class="mt-2 text-end">
          <button type="button" class="btn btn-outline-danger btn-sm remove-lighting">
            ${IconService.createIcon('Trash2')}
            Remove Fixture
          </button>
        </div>
      </div>
    `;
  }

  static getFormData(container) {
    return {
      id: container.dataset.id || crypto.randomUUID(),
      location: container.querySelector('.lighting-location').value.trim(),
      fixture: container.querySelector('.lighting-fixture').value.trim(),
      notes: container.querySelector('.lighting-notes').value.trim()
    };
  }

  static attachEventListeners(container, onUpdate, onRemove) {
    const inputs = container.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        onUpdate(this.getFormData(container));
      });
    });

    const removeBtn = container.querySelector('.remove-lighting');
    if (removeBtn) {
      removeBtn.addEventListener('click', onRemove);
    }
  }
}