import { IconService } from '../../services/IconService.js';
import { validateMedia } from '../../utils/imageUtils.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { isVideo, renderMediaThumbnail } from '../../utils/mediaUtils.js';

export class ContentsImageUpload {
  static render(mediaUrl = null) {
    return `
      <div class="contents-image-upload upload-area p-3 text-center mb-2">
        ${mediaUrl ? this.renderPreview(mediaUrl) : `
          <div class="py-3">
            ${IconService.createIcon('Upload', { 
              class: 'text-muted mb-2',
              width: '24',
              height: '24'
            })}
            <p class="text-muted small mb-0">Click to add photo/video</p>
          </div>
        `}
        ${mediaUrl ? `
          <div class="d-flex justify-content-center">
            <button type="button" class="btn btn-sm btn-outline-danger remove-media">
              ${IconService.createIcon('Trash2')}
              Remove Media
            </button>
          </div>
        ` : ''}
      </div>
      <input type="file" 
             class="d-none contents-media-input" 
             accept="image/*,video/*">
    `;
  }

  static renderPreview(url) {
    return renderMediaThumbnail({ url, size: 'large', showPlayIcon: true });
  }

  static attachEventListeners(container, onMediaChange) {
    const uploadArea = container.querySelector('.contents-image-upload');
    const mediaInput = container.querySelector('.contents-media-input');
    const removeBtn = container.querySelector('.remove-media');

    if (uploadArea && mediaInput) {
      uploadArea.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-media')) {
          mediaInput.click();
        }
      });

      mediaInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          // Validate file
          const error = validateMedia(file);
          if (error) {
            showErrorAlert(error);
            mediaInput.value = '';
            return;
          }

          onMediaChange(file);
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onMediaChange(null);
      });
    }
  }
}