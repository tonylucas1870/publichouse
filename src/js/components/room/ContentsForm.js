import { IconService } from '../../services/IconService.js';
import { ContentsImageUpload } from './ContentsImageUpload.js';
import { ContentsImageService } from '../../services/ContentsImageService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class ContentsForm {
  static render(item = {}) {
    const images = Array.isArray(item.images) ? item.images : [];
    const hasImages = images.length > 0;

    return `
      <div class="contents-form mb-3">
        <div class="row">
          <div class="col-12 col-md-4">
            <div class="contents-images mb-2">
              ${hasImages ? `
                <div class="row g-2">
                  ${images.map((imageUrl, index) => `
                    <div class="col-6">
                      <div class="position-relative">
                        <img src="${imageUrl}" 
                             alt="Item image ${index + 1}" 
                             class="img-fluid rounded"
                             style="height: 100px; width: 100%; object-fit: cover">
                        <button type="button" 
                                class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-image"
                                data-index="${index}">
                          ${IconService.createIcon('X')}
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${images.length < 4 ? ContentsImageUpload.render() : ''}
            </div>
          </div>
          <div class="col-12 col-md-8">
            <div class="mb-2">
              <input type="text" 
                     class="form-control contents-name" 
                     placeholder="Item name"
                     value="${item.name || ''}"
                     required>
            </div>
            <div>
              <textarea class="form-control contents-description" 
                        placeholder="Description"
                        rows="2">${item.description || ''}</textarea>
            </div>
          </div>
        </div>
        <div class="mt-2 text-end">
          <button type="button" class="btn btn-outline-danger btn-sm remove-contents">
            ${IconService.createIcon('Trash2')}
            Remove Item
          </button>
        </div>
      </div>
    `;
  }

  static getFormData(container) {
    return {
      name: container.querySelector('.contents-name').value.trim(),
      description: container.querySelector('.contents-description').value.trim(),
      images: Array.from(container.querySelectorAll('.contents-images img')).map(img => img.src)
    };
  }

  static attachEventListeners(container, onUpdate, onRemove) {
    if (!container || !onUpdate || !onRemove) {
      console.error('Missing required parameters for ContentsForm.attachEventListeners');
      return;
    }

    const nameInput = container.querySelector('.contents-name');
    const descriptionInput = container.querySelector('.contents-description');
    const removeBtn = container.querySelector('.remove-contents');

    // Handle text input changes
    const handleInputChange = () => {
      const data = this.getFormData(container);
      onUpdate(data);
    };

    nameInput?.addEventListener('input', handleInputChange);
    descriptionInput?.addEventListener('input', handleInputChange);

    // Handle image upload
    ContentsImageUpload.attachEventListeners(container, async (file) => {
      try {
        if (file) {
          // Show loading state
          const uploadArea = container.querySelector('.contents-image-upload');
          uploadArea.innerHTML = `
            <div class="py-3">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Uploading...</span>
              </div>
              <p class="text-muted small mb-0 mt-2">Uploading image...</p>
            </div>
          `;

          // Upload image
          const imageUrl = await ContentsImageService.uploadImage(file);
          
          // Get current images
          const currentImages = Array.from(container.querySelectorAll('.contents-images img')).map(img => img.src);
          
          // Add new image
          currentImages.push(imageUrl);
          
          // Re-render images section
          const imagesContainer = container.querySelector('.contents-images');
          imagesContainer.innerHTML = `
            <div class="row g-2">
              ${currentImages.map((url, index) => `
                <div class="col-6">
                  <div class="position-relative">
                    <img src="${url}" 
                         alt="Item image ${index + 1}" 
                         class="img-fluid rounded"
                         style="height: 100px; width: 100%; object-fit: cover">
                    <button type="button" 
                            class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-image"
                            data-index="${index}">
                      ${IconService.createIcon('X')}
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
            ${currentImages.length < 4 ? ContentsImageUpload.render() : ''}
          `;
          
          // Reattach event listeners
          this.attachImageEventListeners(container, onUpdate);

          // Update form data
          onUpdate(this.getFormData(container));
        }
      } catch (error) {
        console.error('Error handling contents image:', error);
        showErrorAlert('Failed to upload image. Please try again.');
        
        // Reset upload area on error
        const uploadArea = container.querySelector('.contents-image-upload');
        uploadArea.outerHTML = ContentsImageUpload.render();
        ContentsImageUpload.attachEventListeners(container, 
          (newFile) => this.handleImageChange(container, newFile, onUpdate));
      }
    });

    // Handle image removal
    this.attachImageEventListeners(container, onUpdate);

    // Handle remove button
    if (removeBtn) {
      removeBtn.addEventListener('click', onRemove);
    }
  }

  static attachImageEventListeners(container, onUpdate) {
    container.querySelectorAll('.remove-image').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const index = parseInt(btn.dataset.index);
        const currentImages = Array.from(container.querySelectorAll('.contents-images img')).map(img => img.src);
        
        // Remove image at index
        currentImages.splice(index, 1);
        
        // Re-render images section
        const imagesContainer = container.querySelector('.contents-images');
        imagesContainer.innerHTML = `
          ${currentImages.length > 0 ? `
            <div class="row g-2">
              ${currentImages.map((url, idx) => `
                <div class="col-6">
                  <div class="position-relative">
                    <img src="${url}" 
                         alt="Item image ${idx + 1}" 
                         class="img-fluid rounded"
                         style="height: 100px; width: 100%; object-fit: cover">
                    <button type="button" 
                            class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-image"
                            data-index="${idx}">
                      ${IconService.createIcon('X')}
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${currentImages.length < 4 ? ContentsImageUpload.render() : ''}
        `;
        
        // Reattach event listeners
        this.attachImageEventListeners(container, onUpdate);
        ContentsImageUpload.attachEventListeners(container, 
          (file) => this.handleImageChange(container, file, onUpdate));
        
        // Update form data
        onUpdate(this.getFormData(container));
      });
    });
  }

  static async handleImageChange(container, file, onUpdate) {
    try {
      const imageUrl = file ? await ContentsImageService.uploadImage(file) : null;
      if (imageUrl) {
        const currentImages = Array.from(container.querySelectorAll('.contents-images img')).map(img => img.src);
        currentImages.push(imageUrl);
        
        // Re-render images section
        const imagesContainer = container.querySelector('.contents-images');
        imagesContainer.innerHTML = `
          <div class="row g-2">
            ${currentImages.map((url, index) => `
              <div class="col-6">
                <div class="position-relative">
                  <img src="${url}" 
                       alt="Item image ${index + 1}" 
                       class="img-fluid rounded"
                       style="height: 100px; width: 100%; object-fit: cover">
                  <button type="button" 
                          class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-image"
                          data-index="${index}">
                    ${IconService.createIcon('X')}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          ${currentImages.length < 4 ? ContentsImageUpload.render() : ''}
        `;
        
        // Reattach event listeners
        this.attachImageEventListeners(container, onUpdate);
        ContentsImageUpload.attachEventListeners(container,
          (newFile) => this.handleImageChange(container, newFile, onUpdate));
      }
      
      // Update form data
      onUpdate(this.getFormData(container));
    } catch (error) {
      console.error('Error handling contents image:', error);
      showErrorAlert('Failed to upload image. Please try again.');
      
      // Reset upload area on error
      const uploadArea = container.querySelector('.contents-image-upload');
      uploadArea.outerHTML = ContentsImageUpload.render();
      ContentsImageUpload.attachEventListeners(container,
        (newFile) => this.handleImageChange(container, newFile, onUpdate));
    }
  }
}