import { IconService } from '../../services/IconService.js';
import { ImageUpload } from '../ui/ImageUpload.js';
import { RoomSelect } from '../ui/RoomSelect.js';
import { RoomDetailsService } from '../../services/RoomDetailsService.js';
import { RoomService } from '../../services/RoomService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { validateMedia } from '../../utils/imageUtils.js';

export class UploadForm {
  constructor(containerId, findingsService, findingsList, changeoverId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error('Upload form container not found');
    }
    this.findingsService = findingsService;
    this.findingsList = findingsList;
    this.changeoverId = changeoverId;
    this.selectedImages = [];
    this.roomSelect = null;
    this.roomDetailsService = new RoomDetailsService();
    
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <form id="findingForm" class="needs-validation" novalidate>
        <div class="mb-3">
          <label for="description" class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('Type')}
            Description
          </label>
          <textarea
            id="description"
            class="form-control"
            placeholder="Describe what you found..."
            required
            rows="3"
          ></textarea>
          <div class="invalid-feedback">
            Please provide a description
          </div>
        </div>

        <div id="locationContainer"></div>
        <div id="contentsContainer"></div>

        <div class="mb-4">
          <label class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('Camera')}
            Images (Optional)
          </label>
          <div class="row g-3 mb-2" id="imagePreviewsContainer">
            <!-- Image previews will be added here -->
          </div>
          <input
            type="file"
            id="imageInput"
            accept="image/*,video/*"
            class="d-none"
            multiple
          />
          <button type="button" class="btn btn-outline-primary w-100" id="addImagesBtn">
            ${IconService.createIcon('Upload')}
            Upload Images/Videos
          </button>
        </div>

        <button type="submit" class="btn btn-primary w-100">
          Submit Finding
        </button>
      </form>
    `;
  }

  attachEventListeners() {
    const form = this.container.querySelector('#findingForm');
    const imageInput = this.container.querySelector('#imageInput');
    const addImagesBtn = this.container.querySelector('#addImagesBtn');
    this.contentsSelect = null;

    // Initialize RoomSelect
    this.roomSelect = new RoomSelect('locationContainer', this.changeoverId);

    // Initialize RoomSelect
    this.roomSelect = new RoomSelect('locationContainer', this.changeoverId);

    // Handle location changes to load contents
    const locationContainer = this.container.querySelector('#locationContainer');
    const contentsContainer = this.container.querySelector('#contentsContainer');
    
    locationContainer?.addEventListener('roomchange', async (e) => {
      const room = e.detail.room;
      if (!room) {
        if (contentsContainer) {
          contentsContainer.innerHTML = '';
        }
        this.contentsSelect = null;
        return;
      }
      
      try {
        // Initialize contents select
        const { ContentsSelect } = await import('../ui/ContentsSelect.js');
        this.contentsSelect = new ContentsSelect('contentsContainer', room.id);
      } catch (error) {
        console.error('Error loading room contents:', error);
        if (contentsContainer) {
          contentsContainer.innerHTML = '';
        }
        this.contentsSelect = null;
      }
    });

    addImagesBtn.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
        const error = validateMedia(file);
        const isVideo = file.type.startsWith('video/');
        if (error) {
          showErrorAlert(error);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          this.selectedImages.push({
            file,
            isVideo,
            previewUrl: e.target.result
          });
          this.updateImagePreviews();
        };
        reader.readAsDataURL(file);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }

      try {
        const contentItem = this.contentsSelect?.getValue();
        
        // If we have a room and content item, ensure it's added to room contents
        if (contentItem && this.roomSelect) {
          const roomName = this.roomSelect.getValue();
          const rooms = await this.roomSelect.getRooms();
          const room = rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
          
          if (room) {
            try {
              await this.roomDetailsService.addContentItem(room.id, contentItem);
            } catch (error) {
              console.error('Error adding content item to room:', error);
              // Continue with finding submission even if content item update fails
            }
          }
        }

        console.debug('UploadForm: Submitting finding', {
          description: form.description.value.trim(),
          location: this.roomSelect.getValue(),
          hasContentItem: contentItem !== null && contentItem !== undefined,
          contentItem,
          imageCount: this.selectedImages.length
        });

        await this.findingsService.add({
          description: form.description.value.trim(),
          location: this.roomSelect.getValue(),
          content_item: contentItem, // Match the database column name
          images: this.selectedImages.length > 0 ? this.selectedImages.map(img => img.file) : [],
          changeoverId: this.changeoverId
        });

        // Reset form
        form.reset();
        this.selectedImages = [];
        this.updateImagePreviews();
        form.classList.remove('was-validated');
        this.container.querySelector('#contentsContainer').innerHTML = '';
        this.contentsSelect = null;
        
        // Refresh findings list
        this.findingsList.refresh();
        
        showErrorAlert('Finding submitted successfully', 'success');
      } catch (error) {
        console.error('Error submitting finding:', error);
        showErrorAlert(error.message || 'Failed to submit finding');
      }
    });
  }

  updateImagePreviews() {
    const container = this.container.querySelector('#imagePreviewsContainer');
    container.innerHTML = this.selectedImages.map((img, index) => `
      <div class="col-4 col-md-3">
        <div class="position-relative">
          ${img.isVideo ? `
          <div class="position-relative" style="height: 120px; background: #f8f9fa; display: flex; align-items: center; justify-content: center">
            <i class="fas fa-play fa-2x text-muted"></i>
          </div>
          ` : `
          <img 
            src="${img.previewUrl}" 
            alt="Preview"
            class="img-fluid rounded"
            style="height: 100px; width: 100%; object-fit: cover"
          />
          `}
          <button 
            type="button" 
            class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-image"
            data-index="${index}">
            ${IconService.createIcon('Trash2')}
          </button>
        </div>
      </div>
    `).join('');

    // Attach remove buttons event listeners
    container.querySelectorAll('.remove-image').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.selectedImages.splice(index, 1);
        this.updateImagePreviews();
      });
    });
  }
}