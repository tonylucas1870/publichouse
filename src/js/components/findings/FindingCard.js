import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { StatusBadge } from '../ui/StatusBadge.js';

export class FindingCard {
  static render(finding) {
    console.debug('FindingCard: Rendering finding', {
      id: finding.id,
      hasContentItem: !!finding.content_item,
      contentItem: finding.content_item
    });
    
    const mainImage = finding.images[0];
    
    return `
      <div class="card h-100" style="cursor: pointer">
        <img
          src="${finding.images[0]}"
          alt="${finding.description}"
          class="card-img-top"
          style="height: 200px; object-fit: cover"
        />
        ${finding.images.length > 1 ? `
          <div class="position-absolute top-0 end-0 m-2">
            <span class="badge bg-dark bg-opacity-75">
              +${finding.images.length - 1} more
            </span>
          </div>
        ` : ''}
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            ${StatusBadge.render(finding.status)}
            <small class="text-muted">${formatDate(finding.date_found)}</small>
          </div>
          <p class="card-text">${finding.description}</p>
          ${finding.content_item ? `
            <p class="card-text text-muted d-flex align-items-center gap-1 mb-2">
              ${IconService.createIcon('Package', { width: '16', height: '16' })}
              ${finding.content_item.name}
            </p>
          ` : ''}
          <p class="card-text text-muted d-flex align-items-center gap-1">
            ${IconService.createIcon('MapPin', { width: '16', height: '16' })}
            ${finding.location}
          </p>
        </div>
      </div>
    `;
  }
}