import { IconService } from '../services/IconService.js';

export class UploadForm {
  constructor(formId, findingsService, findingsList, authService) {
    this.form = document.getElementById(formId);
    this.imageUpload = document.getElementById('imageUpload');
    this.imageInput = document.getElementById('image');
    this.findingsService = findingsService;
    this.findingsList = findingsList;
    this.authService = authService;
    this.previewUrl = null;

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.imageUpload.addEventListener('click', () => this.imageInput.click());
    this.imageInput.addEventListener('change', (e) => this.handleImageChange(e));
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      this.previewUrl = URL.createObjectURL(file);
      this.imageUpload.innerHTML = `
        <img 
          src="${this.previewUrl}" 
          alt="Preview" 
          class="img-fluid rounded" 
          style="max-height: 200px"
        />
      `;
    }
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!this.authService.isAuthenticated()) {
      alert('Please sign in to submit a finding');
      return;
    }

    const formData = new FormData(this.form);
    
    try {
      const finding = await this.findingsService.add({
        description: formData.get('description'),
        location: formData.get('location'),
        image: formData.get('image')
      });
      
      await this.findingsList.render();
      this.resetForm();
    } catch (error) {
      console.error('Error submitting finding:', error);
      alert('Failed to submit finding. Please try again.');
    }
  }

  resetForm() {
    this.form.reset();
    this.previewUrl = null;
    this.imageUpload.innerHTML = `
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