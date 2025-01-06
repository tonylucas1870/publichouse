import { IconService } from '../../services/IconService.js';
import { Modal } from '../ui/Modal.js';
import { StatusSelect } from '../ui/StatusSelect.js';
import { formatDate } from '../../utils/dateUtils.js';
import { FindingNotes } from './FindingNotes.js';
import { authStore } from '../../auth/AuthStore.js';

export class FindingModal {
  static show(finding, onUpdateStatus, onAddNote) {
    const isEditable = authStore.isAuthenticated();
    const images = Array.isArray(finding.images) ? finding.images : [finding.image_url];

    const { modal, closeModal } = Modal.show({
      title: 'Finding Details',
      size: 'large',
      content: `
        <div class="row g-4">
          <!-- Image Column -->
          <div class="col-12 col-lg-6">
            ${this.renderImageCarousel(images)}
          </div>
          
          <!-- Details Column -->
          <div class="col-12 col-lg-6">
            <div class="mb-3">
              <label class="form-label">Status</label>
              ${StatusSelect.render(finding.status, isEditable)}
            </div>
            <div class="mb-3">
              <label class="form-label">Date Found</label>
              <div class="form-control-plaintext">
                ${formatDate(finding.date_found)}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Description</label>
              <div class="form-control-plaintext">
                ${finding.description}
              </div>
            </div>
            ${finding.content_item ? `
              <div class="mb-3">
                <label class="form-label d-flex align-items-center gap-2">
                  ${IconService.createIcon('Package')}
                  Item
                </label>
                <div class="form-control-plaintext">
                  <a href="#" class="text-decoration-none d-inline-flex align-items-center gap-2 view-content-item" 
                     data-item='${JSON.stringify(finding.content_item)}'>
                    ${finding.content_item.name}
                    ${IconService.createIcon('ExternalLink', { width: '14', height: '14' })}
                  </a>
                </div>
              </div>
            ` : ''}
            <div class="mb-3">
              <label class="form-label d-flex align-items-center gap-2">
                ${IconService.createIcon('MapPin')}
                Location
              </label>
              <div class="form-control-plaintext">
                ${finding.location}
              </div>
            </div>
            <hr>
            ${FindingNotes.render(finding.notes || [])}
          </div>
        </div>
      `
    });

    // Initialize carousel if we have multiple images
    if (images.length > 1) {
      this.initializeCarousel(modal, images);
    }

    // Attach content item click handler
    const contentItemLink = modal.querySelector('.view-content-item');
    if (contentItemLink) {
      contentItemLink.addEventListener('click', (e) => {
        e.preventDefault();
        const itemData = JSON.parse(contentItemLink.dataset.item);
        import('../room/ContentsModal.js').then(({ ContentsModal }) => {
          ContentsModal.show(itemData);
        });
      });
    }

    // Attach notes event listeners
    const notesContainer = modal.querySelector('.finding-notes');
    if (notesContainer) {
      FindingNotes.attachEventListeners(notesContainer, async (text) => {
        await onAddNote(finding.id, text);
        closeModal();
      });
    }

    // Attach status change listener if editable
    if (isEditable) {
      StatusSelect.attachEventListeners(modal, async (newStatus) => {
        await onUpdateStatus(finding.id, newStatus);
        closeModal();
      });
    }
  }

  static renderImageCarousel(images) {
    if (!images || images.length === 0) return '';

    const hasMultipleImages = images.length > 1;

    return `
      <div class="image-section">
        <div id="findingImages" class="carousel slide mb-3" data-bs-ride="false">
          <div class="carousel-inner">
            ${images.map((image, index) => `
              <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img
                  src="${image}"
                  alt="Finding image ${index + 1}"
                  class="d-block w-100 rounded"
                  style="max-height: 400px; object-fit: contain; background: #f8f9fa"
                />
              </div>
            `).join('')}
          </div>
          ${hasMultipleImages ? this.renderCarouselControls(images.length) : ''}
        </div>
        ${hasMultipleImages ? this.renderThumbnails(images) : ''}
      </div>
    `;
  }

  static renderCarouselControls(count) {
    return `
      <button class="carousel-control-prev" type="button" data-bs-target="#findingImages" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Previous</span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#findingImages" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Next</span>
      </button>
      <div class="carousel-indicators">
        ${Array.from({ length: count }, (_, i) => `
          <button type="button" 
                  data-bs-target="#findingImages" 
                  data-bs-slide-to="${i}"
                  class="${i === 0 ? 'active' : ''}"
                  aria-current="${i === 0 ? 'true' : 'false'}"
                  aria-label="Slide ${i + 1}">
          </button>
        `).join('')}
      </div>
    `;
  }

  static renderThumbnails(images) {
    return `
      <div class="row g-2">
        ${images.map((image, index) => `
          <div class="col-3">
            <img
              src="${image}"
              alt="Thumbnail ${index + 1}"
              class="img-thumbnail thumbnail-nav${index === 0 ? ' active' : ''}"
              data-index="${index}"
              style="height: 60px; width: 100%; object-fit: cover; cursor: pointer"
            />
          </div>
        `).join('')}
      </div>
    `;
  }

  static initializeCarousel(modal, images) {
    if (images.length <= 1) return;

    const carousel = modal.querySelector('#findingImages');
    const thumbnails = modal.querySelectorAll('.thumbnail-nav');
    
    if (!carousel || !thumbnails.length) return;

    // Handle thumbnail clicks
    thumbnails.forEach(thumb => {
      thumb.addEventListener('click', () => {
        const index = parseInt(thumb.dataset.index);
        this.updateCarousel(carousel, index);
      });
    });

    // Handle carousel controls
    carousel.querySelectorAll('[data-bs-slide]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const direction = btn.dataset.bsSlide;
        const items = carousel.querySelectorAll('.carousel-item');
        const activeItem = carousel.querySelector('.carousel-item.active');
        const currentIndex = Array.from(items).indexOf(activeItem);
        
        const newIndex = direction === 'prev' ? 
          (currentIndex - 1 + items.length) % items.length : 
          (currentIndex + 1) % items.length;
        
        this.updateCarousel(carousel, newIndex);
      });
    });

    // Handle indicator clicks
    carousel.querySelectorAll('.carousel-indicators button').forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        this.updateCarousel(carousel, index);
      });
    });
  }

  static updateCarousel(carousel, newIndex) {
    const items = carousel.querySelectorAll('.carousel-item');
    const thumbnails = carousel.closest('.image-section').querySelectorAll('.thumbnail-nav');
    const indicators = carousel.querySelectorAll('.carousel-indicators button');
    
    // Update carousel
    carousel.querySelector('.carousel-item.active')?.classList.remove('active');
    items[newIndex]?.classList.add('active');
    
    // Update thumbnails
    carousel.closest('.image-section').querySelector('.thumbnail-nav.active')?.classList.remove('active');
    thumbnails[newIndex]?.classList.add('active');
    
    // Update indicators
    indicators.forEach((indicator, i) => {
      indicator.classList.toggle('active', i === newIndex);
      indicator.setAttribute('aria-current', i === newIndex ? 'true' : 'false');
    });
  }
}