import { IconService } from '../../services/IconService.js';

export class ContentsImageUpload {
  static render(imageUrl = null) {
    return `
      <div class="contents-image-upload upload-area p-3 text-center mb-2">
        ${imageUrl ? `
          <img src="${imageUrl}" 
               alt="Item" 
               class="img-fluid rounded mb-2" 
               style="max-height: 150px">
          <div class="d-flex justify-content-center">
            <button type="button" class="btn btn-sm btn-outline-danger remove-image">
              ${IconService.createIcon('Trash2')}
              Remove Image
            </button>
          </div>
        ` : `
          <div class="py-3">
            ${IconService.createIcon('Upload', { 
              class: 'text-muted mb-2',
              width: '24',
              height: '24'
            })}
            <p class="text-muted small mb-0">Click to add photo</p>
          </div>
        `}
      </div>
      <input type="file" 
             class="d-none contents-image-input" 
             accept="image/*">
    `;
  }

  static attachEventListeners(container, onImageChange) {
    const uploadArea = container.querySelector('.contents-image-upload');
    const imageInput = container.querySelector('.contents-image-input');
    const removeBtn = container.querySelector('.remove-image');

    if (uploadArea && imageInput) {
      uploadArea.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-image')) {
          imageInput.click();
        }
      });

      imageInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          onImageChange(file);
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onImageChange(null);
      });
    }
  }
}