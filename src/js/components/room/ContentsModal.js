import { IconService } from '../../services/IconService.js';

export class ContentsModal {
  static show(item) {
    const { modal, closeModal } = this.createModal(item);
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    console.debug('ContentsModal: Modal created and added to DOM');

    // Initialize carousel if we have multiple images
    if (item.images?.length > 1) {
      this.initializeCarousel(modal, item.images);
    }

    // Close modal events
    const handleClose = () => {
      console.debug('ContentsModal: Closing modal');
      document.removeEventListener('keydown', handleEsc);
      modal.removeEventListener('click', handleBackdropClick);
      closeModal();
    };

    const handleEsc = (e) => {
      console.debug('ContentsModal: Key pressed', { key: e.key });
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    const handleBackdropClick = (e) => {
      console.debug('ContentsModal: Click event', {
        target: e.target,
        currentTarget: e.currentTarget,
        targetClasses: e.target.className,
        hasModalDialog: !!e.target.closest('.modal-dialog')
      });
      
      if (!e.target.closest('.modal-dialog')) {
        console.debug('ContentsModal: Closing on backdrop click');
        handleClose();
      }
    };

    // Attach event listeners
    document.addEventListener('keydown', handleEsc);
    modal.addEventListener('click', handleBackdropClick);
    modal.querySelector('.btn-close').addEventListener('click', handleClose);
  }

  static createModal(item) {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';

    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${item.name}</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-4">
              <!-- Image Column -->
              <div class="col-12">
                ${this.renderImageCarousel(item.images)}
              </div>
              
              <!-- Details Column -->
              <div class="col-12">
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <div class="form-control-plaintext">
                    ${item.description || 'No description provided'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    `;

    const closeModal = () => {
      document.body.removeChild(modal);
      document.body.classList.remove('modal-open');
    };

    return { modal, closeModal };
  }

  static renderImageCarousel(images) {
    if (!Array.isArray(images) || !images.length) return '';

    const hasMultipleImages = images.length > 1;

    return `
      <div class="image-section">
        <div id="contentsImages" class="carousel slide mb-3" data-bs-ride="false">
          <div class="carousel-inner">
            ${images.map((image, index) => `
              <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img
                  src="${image || ''}"
                  alt="Item image ${index + 1}"
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
      <button class="carousel-control-prev" type="button" data-bs-target="#contentsImages" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Previous</span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#contentsImages" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Next</span>
      </button>
      <div class="carousel-indicators">
        ${Array.from({ length: count }, (_, i) => `
          <button type="button" 
                  data-bs-target="#contentsImages" 
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

    const carousel = modal.querySelector('#contentsImages');
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