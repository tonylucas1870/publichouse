import { IconService } from '../../services/IconService.js';
import { Modal } from '../ui/Modal.js';
import { formatDate } from '../../utils/dateUtils.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { FindingModal } from '../findings/FindingModal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class ContentItemFindings {
  static async show(contentItem, findingsService) {
    try {
      // Get all findings
      const relatedFindings = await findingsService.getFindingsByContentItem(contentItem.name);

      const { modal, closeModal } = Modal.show({
        title: contentItem.name,
        size: 'large',
        content: `
          <div class="row g-4">
            <!-- Content Item Details -->
            <div class="col-12">
              ${this.renderContentDetails(contentItem)}
            </div>

            <!-- Related Findings -->
            <div class="col-12">
              <h6 class="mb-3 d-flex align-items-center gap-2">
                ${IconService.createIcon('Search')}
                Related Findings
              </h6>
              <div class="list-group list-group-flush">
                ${relatedFindings.length ? relatedFindings.map(finding => `
                  <div class="list-group-item finding-item" data-finding-id="${finding.id}">
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <div class="d-flex align-items-center gap-2 mb-2">
                          ${StatusBadge.render(finding.status)}
                          <small class="text-muted">${formatDate(finding.date_found)}</small>
                        </div>
                        <p class="mb-1">${finding.description}</p>
                        <small class="text-muted d-flex align-items-center gap-1">
                          ${IconService.createIcon('MapPin', { width: '14', height: '14' })}
                          ${finding.location}
                        </small>
                      </div>
                      <div class="ms-3">
                        <img 
                          src="${finding.images[0]?.url || finding.images[0]}" 
                          alt="Finding thumbnail" 
                          class="rounded" 
                          style="width: 60px; height: 60px; object-fit: cover"
                        >
                      </div>
                    </div>
                  </div>
                `).join('') : `
                  <div class="text-center p-4 text-muted">
                    No findings reported for this item yet
                  </div>
                `}
              </div>
            </div>
          </div>
        `
      });

      // Initialize carousel if we have multiple images
      if (contentItem.images?.length > 1) {
        this.initializeCarousel(modal, contentItem.images);
      }

      // Attach click handlers for findings
      modal.querySelectorAll('.finding-item').forEach(item => {
        item.addEventListener('click', () => {
          const findingId = item.dataset.findingId;
          const finding = relatedFindings.find(f => f.id === findingId);
          if (finding) {
            closeModal();
            FindingModal.show(
              finding,
              findingsService,
              async (findingId, status) => {
                await findingsService.updateStatus(findingId, status);
                // Reopen findings modal with refreshed data
                ContentItemFindings.show(contentItem, findingsService);
              },
              async (findingId, text) => {
                await findingsService.addNote(findingId, text);
                // Reopen findings modal with refreshed data
                ContentItemFindings.show(contentItem, findingsService);
              }
            );
          }
        });
      });

    } catch (error) {
      console.error('Error showing content item findings:', error);
      showErrorAlert('Failed to load findings');
    }
  }

  static renderContentDetails(item) {
    return `
      <div class="card">
        <div class="card-body">
          <!-- Image Carousel -->
          ${this.renderImageCarousel(item.images)}

          <!-- Details -->
          <div class="mt-4">
            <h6 class="mb-3">Description</h6>
            <p class="text-muted mb-0">
              ${item.description || 'No description provided'}
            </p>
          </div>
        </div>
      </div>
    `;
  }

  static renderImageCarousel(images) {
    if (!Array.isArray(images) || !images.length) return '';

    const hasMultipleImages = images.length > 1;

    return `
      <div class="image-section">
        <div id="contentImages" class="carousel slide mb-3" data-bs-ride="false">
          <div class="carousel-inner">
            ${images.map((image, index) => `
              <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img
                  src="${image}"
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
      <button class="carousel-control-prev" type="button" data-bs-target="#contentImages" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Previous</span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#contentImages" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Next</span>
      </button>
      <div class="carousel-indicators">
        ${Array.from({ length: count }, (_, i) => `
          <button type="button" 
                  data-bs-target="#contentImages" 
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

    const carousel = modal.querySelector('#contentImages');
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