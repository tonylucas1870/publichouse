import { IconService } from '../../services/IconService.js';

export class ImageUpload {
  static render() {
    return `
      <div class="upload-area p-4 text-center">
        <div class="py-4">
          ${IconService.createIcon('Upload', { 
            class: 'text-muted mb-2',
            width: '32',
            height: '32'
          })}
          <p class="text-muted mb-0">Click to upload an image</p>
        </div>
      </div>
    `;
  }

  static updatePreview(element, imageUrl) {
    element.innerHTML = `
      <img 
        src="${imageUrl}" 
        alt="Preview" 
        class="img-fluid rounded" 
        style="max-height: 200px"
      />
    `;
  }

  static resetPreview(element) {
    element.innerHTML = `
      <div class="py-4">
        ${IconService.createIcon('Upload', { 
          class: 'text-muted mb-2',
          width: '32',
          height: '32'
        })}
        <p class="text-muted mb-0">Click to upload an image</p>
      </div>
    `;
  }
}