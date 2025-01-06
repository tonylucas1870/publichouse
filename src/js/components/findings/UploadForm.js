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

    if (!this.container) {
      throw new Error('Upload form container not found');
    }

    this.findingsService = findingsService;
    this.findingsList = findingsList;
    this.changeoverId = changeoverId;
    this.selectedImages = [];
    
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <form id="findingForm" class="needs-validation" novalidate>
        <div id="locationContainer">
        <div class="mb-3">
          <label for="location" class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('MapPin')}
            Location
          </label>
          <input
            type="text"
            id="location"
            class="form-control"
            list="roomSuggestions"
            placeholder="Select or type a room name..."
            required
            autocomplete="off"
          />
          <datalist id="roomSuggestions"></datalist>
          <div class="invalid-feedback">
            Please specify where the item was found
          </div>
        </div>
        <div id="contentsContainer"></div>
        </div>

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
    const locationInput = this.container.querySelector('#location');
    const contentsContainer = this.container.querySelector('#contentsContainer');
    const roomSuggestions = this.container.querySelector('#roomSuggestions');
    const roomService = new RoomService();
    this.contentsSelect = null;

    // Load room suggestions
    console.debug('UploadForm: Loading room suggestions');
    roomService.getRooms(this.changeoverId, true).then(rooms => {
      console.debug('UploadForm: Got rooms', { 
        count: rooms?.length,
        rooms: rooms?.map(r => r.name)
      });
      roomSuggestions.innerHTML = rooms
        .map(room => `<option value="${room.name}">`)
        .join('');
      console.debug('UploadForm: Updated datalist options', {
        optionsCount: roomSuggestions.children.length,
        html: roomSuggestions.innerHTML
      });
    }).catch(error => {
      console.error('Error loading rooms:', error);
    });

    // Handle location changes to load contents
    locationInput.addEventListener('change', async (e) => {
      const location = e.target.value.trim();
      if (!location) {
        contentsContainer.innerHTML = '';
        this.contentsSelect = null;
        return;
      }

      // Get room ID for the selected location
      try {
        const rooms = await roomService.getRooms(this.changeoverId, true);
        const room = rooms.find(r => r.name === location);
        
        if (room) {
          // Initialize contents select
          import('../ui/ContentsSelect.js').then(({ ContentsSelect }) => {
            this.contentsSelect = new ContentsSelect('contentsContainer', room.id);
          });
        } else {
          contentsContainer.innerHTML = '';
          this.contentsSelect = null;
        }
      } catch (error) {
        console.error('Error loading room contents:', error);
        contentsContainer.innerHTML = '';
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
          location: locationInput.value.trim(),
          hasContentItem: !!contentItem,
          contentItem,
          imageCount: this.selectedImages.length
        });

        await this.findingsService.add({
          description: form.description.value.trim(),
          location: locationInput.value.trim(),
          contentItem,
          images: this.selectedImages.map(img => img.file),
          changeoverId: this.changeoverId
        });

        // Reset form
        form.reset();
        this.selectedImages = [];
        this.updateImagePreviews();
        form.classList.remove('was-validated');
        contentsContainer.innerHTML = '';
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