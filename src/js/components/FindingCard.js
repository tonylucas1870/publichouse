import { IconService } from '../services/IconService.js';
import { StatusBadge } from './StatusBadge.js';
import { formatDate } from '../utils/dateUtils.js';

export class FindingCard {
  static render(finding) {
    return `
      <div class="col">
        <div class="card h-100">
          <img
            src="${finding.image_url}"
            alt="${finding.description}"
            class="card-img-top"
            style="height: 200px; object-fit: cover"
          />
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              ${StatusBadge.render(finding.status)}
              <small class="text-muted">${formatDate(finding.date_found)}</small>
            </div>
            <p class="card-text">${finding.description}</p>
            <p class="card-text text-muted d-flex align-items-center gap-1">
              ${IconService.createIcon('MapPin', { width: '16', height: '16' })}
              ${finding.location}
            </p>
          </div>
        </div>
      </div>
    `;
  }
}