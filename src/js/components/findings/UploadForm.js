import { IconService } from '../../services/IconService.js';
import { ImageUpload } from '../ui/ImageUpload.js';
import { RoomSelect } from '../ui/RoomSelect.js';
import { RoomService } from '../../services/RoomService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { validateImage } from '../../utils/imageUtils.js';

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
    
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <form id="findingForm" class="needs-validation" novalidate>
        <div id="locationContainer"></div>
        <div id="contentsContainer"></div>

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

        <div class="mb-4">
          <label class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('Camera')}
            Images
          </label>
          <div class="row g-3 mb-2" id="imagePreviewsContainer">
            <!-- Image previews will be added here -->
          </div>
          <input
            type="file"
            id="imageInput"
            accept="image/*"
            class="d-none"
            multiple
          />
          <button type="button" class="btn btn-outline-primary w-100" id="addImagesBtn">
            ${IconService.createIcon('Plus')}
            Add Images
          </button>
          <div id="imageError" class="invalid-feedback" style="display: none;">
            Please add at least one image
          </div>
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
        const error = validateImage(file);
        if (error) {
          showErrorAlert(error);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          this.selectedImages.push({
            file,
            previewUrl: e.target.result
          });
          this.updateImagePreviews();
        };
        reader.readAsDataURL(file);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!form.checkValidity() || this.selectedImages.length === 0) {
        form.classList.add('was-validated');
        if (this.selectedImages.length === 0) {
          document.getElementById('imageError').style.display = 'block';
        }
        return;
      }

      try {
        const contentItem = this.contentsSelect?.getValue();
        console.debug('UploadForm: Submitting finding', {
          description: form.description.value.trim(),
          location: this.roomSelect.getValue(),
          hasContentItem: !!contentItem,
          contentItem,
          imageCount: this.selectedImages.length
        });

        await this.findingsService.add({
          description: form.description.value.trim(),
          location: this.roomSelect.getValue(),
          contentItem,
          images: this.selectedImages.map(img => img.file),
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
          <img 
            src="${img.previewUrl}" 
            class="img-fluid rounded" 
            alt="Preview"
            style="width: 100%; height: 120px; object-fit: cover"
          />
          <button 
            type="button" 
            class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1 remove-image"
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