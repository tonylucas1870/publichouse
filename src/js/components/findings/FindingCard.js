import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { StatusBadge } from '../ui/StatusBadge.js';

export class FindingCard {
  static render(finding) {
    console.debug('FindingCard: Rendering finding', {
      id: finding.id,
      hasContentItem: finding.content_item !== null && finding.content_item !== undefined
    });
    
    // Handle both string and object image formats
    const hasImages = Array.isArray(finding.images) && finding.images.length > 0;
    const mainImage = hasImages ? (finding.images[0]?.url || finding.images[0]) : null;
    const isVideo = mainImage && (mainImage.toLowerCase().includes('.mp4') || mainImage.toLowerCase().includes('.webm'));
    
    return `
      <div class="card h-100" style="cursor: pointer">
        ${hasImages ? `
          ${isVideo ? `
          <div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height: 200px">
            <div class="text-center">
              <i class="fas fa-play-circle fa-3x text-muted mb-2"></i>
              <div class="text-muted small">Video</div>
            </div>
          </div>
          ` : `
          <img
            src="${mainImage}"
            alt="${finding.description}"
            class="card-img-top"
            style="height: 200px; object-fit: cover"
          />
          `}
          ${finding.images.length > 1 ? `
          <div class="position-absolute top-0 end-0 m-2">
            <span class="badge bg-dark bg-opacity-75">
              +${finding.images.length - 1} more
            </span>
          </div>
          ` : ''}
        ` : `
          <div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height: 200px">
            ${IconService.createIcon('Image', { width: '48', height: '48', class: 'text-muted opacity-25' })}
          </div>
        `}
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            ${StatusBadge.render(finding.status)}
            <small class="text-muted">${formatDate(finding.date_found)}</small>
          </div>
          <p class="card-text">${finding.description}</p>
         
          <p class="card-text text-muted d-flex align-items-center gap-1">
            ${IconService.createIcon('MapPin', { width: '16', height: '16' })}
             ${finding.content_item ? `${finding.content_item.name} @` : ''}
            ${finding.location}
          </p>
        </div>
      </div>
    `;
  }
}