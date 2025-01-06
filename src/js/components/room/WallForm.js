import { IconService } from '../../services/IconService.js';

export class WallForm {
  static render(wall = {}) {
    return `
      <div class="wall-form mb-3">
        <div class="row g-3">
          <div class="col-md-6">
            <input type="text" 
                   class="form-control wall-location" 
                   placeholder="Wall location (e.g., North Wall, Behind TV)"
                   value="${wall.location || ''}"
                   required>
          </div>
          <div class="col-md-6">
            <input type="text" 
                   class="form-control wall-color" 
                   placeholder="Paint color/Wall Paper"
                   value="${wall.color || ''}"
                   required>
          </div>
          <div class="col-12">
            <textarea class="form-control wall-notes" 
                      placeholder="Additional notes"
                      rows="2">${wall.notes || ''}</textarea>
          </div>
        </div>
        <div class="mt-2 text-end">
          <button type="button" class="btn btn-outline-danger btn-sm remove-wall">
            ${IconService.createIcon('Trash2')}
            Remove Wall
          </button>
        </div>
      </div>
    `;
  }

  static getFormData(container) {
    return {
      id: container.dataset.id || crypto.randomUUID(),
      location: container.querySelector('.wall-location').value.trim(),
      color: container.querySelector('.wall-color').value.trim(),
      notes: container.querySelector('.wall-notes').value.trim()
    };
  }

  static attachEventListeners(container, onUpdate, onRemove) {
    const inputs = container.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        onUpdate(this.getFormData(container));
      });
    });

    const removeBtn = container.querySelector('.remove-wall');
    if (removeBtn) {
      removeBtn.addEventListener('click', onRemove);
    }
  }
}