import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { FindingModal } from '../findings/FindingModal.js';
import { isVideo } from '../../utils/mediaUtils.js';

export class ContentsModal {
  static async show(item, findingsService) {
    // Ensure images array exists
    if (!Array.isArray(item.images)) {
      item.images = [];
    }
    
    // Debug: Log item images
    console.debug('ContentsModal: Item images', {
      images: item.images,
      imageTypes: item.images.map(img => {
        const url = typeof img === 'string' ? img : img.url;
        return {
          url,
          isVideo: isVideo(url),
          urlType: typeof url,
          fullImage: img
        };
      })
    });

    const { modal, closeModal } = this.createModal(item);
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    console.debug('ContentsModal: Modal created', {
      name: item.name,
      description: item.description,
      hasImages: Array.isArray(item.images),
      imageCount: item.images?.length,
      hasFindingsService: !!findingsService
    });

    // Load findings if we have a findings service
    if (findingsService) {
      try {
        const findings = await findingsService.getFindingsByContentItem(item.name || '');
        console.debug('ContentsModal: Loaded findings', {
          findingsCount: findings.length,
          findings: findings.map(f => ({
            id: f.id,
            description: f.description,
            hasImages: !!f.images,
            imageCount: f.images?.length
          }))
        });
        const findingsContainer = modal.querySelector('#findingsContainer');
        if (findingsContainer && findings.length > 0) {
          findingsContainer.innerHTML = `
            <hr class="my-4">
            <div>
              <h6 class="mb-3 d-flex align-items-center gap-2">
                ${IconService.createIcon('Search')}
                Related Findings
              </h6>
              <div class="list-group list-group-flush">
                ${findings.map(finding => `
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
                `).join('')}
              </div>
            </div>
          `;

          // Attach click handlers for findings
          findingsContainer.querySelectorAll('.finding-item').forEach(item => {
            item.addEventListener('click', () => {
              const findingId = item.dataset.findingId;
              const finding = findings.find(f => f.id === findingId);
              if (finding) {
                closeModal();
                FindingModal.show(
                  finding,
                  findingsService,
                  async (findingId, status) => {
                    await findingsService.updateStatus(findingId, status);
                    // Reopen content modal with refreshed data
                    ContentsModal.show(item, findingsService);
                  },
                  async (findingId, text) => {
                    await findingsService.addNote(findingId, text);
                    // Reopen content modal with refreshed data
                    ContentsModal.show(item, findingsService);
                  }
                );
              }
            });
          });
        }
      } catch (error) {
        console.error('Error loading findings:', error);
        const findingsContainer = modal.querySelector('#findingsContainer');
        if (findingsContainer) {
          findingsContainer.innerHTML = `
            <div class="alert alert-danger">
              Failed to load findings
            </div>
          `;
        }
      }
    }

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
                  <div class="d-flex justify-content-between align-items-start">
                    <div class="form-control-plaintext">
                      ${item.description || 'No description provided'}
                    </div>
                  </div>
                </div>
                <div id="findingsContainer"></div>
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
    const normalizedImages = images.map(img => {
      const imgObj = typeof img === 'string' ? { url: img } : img;
      const videoDetected = isVideo(imgObj.url);
      
      // Debug: Log image normalization
      console.debug('ContentsModal: Normalizing image', {
        original: img,
        normalized: imgObj,
        url: imgObj.url,
        isVideo: videoDetected,
        urlLower: imgObj.url?.toLowerCase(),
        includesMp4: imgObj.url?.toLowerCase().includes('.mp4'),
        includesWebm: imgObj.url?.toLowerCase().includes('.webm')
      });
      
      imgObj.isVideo = videoDetected;
      return imgObj;
    });

    // Debug: Log all normalized images
    console.debug('ContentsModal: All normalized images', {
      count: normalizedImages.length,
      images: normalizedImages.map(img => ({
        url: img.url,
        isVideo: img.isVideo
      }))
    });

    return `
      <div class="image-section">
        <div id="contentsImages" class="carousel slide mb-3" data-bs-ride="false">
          <div class="carousel-inner">
            ${normalizedImages.map((image, index) => `
              <div class="carousel-item ${index === 0 ? 'active' : ''}">
                ${image.isVideo ? `
                <video
                  src="${image.url}"
                  class="d-block w-100 rounded"
                  style="max-height: 400px; object-fit: contain; background: #f8f9fa"
                  controls
                  controlsList="nodownload"
                >
                  Your browser does not support video playback
                </video>
                ` : `
                <img
                  src="${image.url || image}"
                  alt="Item image ${index + 1}"
                  class="d-block w-100 rounded"
                  style="max-height: 400px; object-fit: contain; background: #f8f9fa"
                />`}
              </div>
            `).join('')}
          </div>
          ${hasMultipleImages ? this.renderCarouselControls(images.length) : ''}
        </div>
        ${hasMultipleImages ? this.renderThumbnails(normalizedImages) : ''}
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
        ${images.map((image, index) => {
          // Debug: Log thumbnail rendering
          console.debug('ContentsModal: Rendering thumbnail', {
            index,
            url: image.url,
            isVideo: image.isVideo
          });
          
          return `
          <div class="col-3">
            ${image.isVideo ? `
            <div class="img-thumbnail thumbnail-nav${index === 0 ? ' active' : ''}"
                 data-index="${index}"
                 style="height: 60px; width: 100%; background: #f8f9fa; display: flex; align-items: center; justify-content: center; cursor: pointer">
              <i class="fas fa-play"></i>
            </div>
            ` : `
            <img
              src="${image.url}"
              alt="Thumbnail ${index + 1}"
              class="img-thumbnail thumbnail-nav${index === 0 ? ' active' : ''}"
              data-index="${index}"
              style="height: 60px; width: 100%; object-fit: cover; cursor: pointer"
            />`}
          </div>
        `;
        }).join('')}
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