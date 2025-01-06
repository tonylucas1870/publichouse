import { IconService } from '../../services/IconService.js';

export class PropertyHeader {
  static render(property) {
    return `
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <h2 class="h4 mb-2">${property.name}</h2>
          <p class="text-muted mb-0 d-flex align-items-center gap-2">
            ${IconService.createIcon('MapPin')}
            ${property.address}
          </p>
        </div>
        ${property.isAdmin ? `
          <button class="btn btn-outline-primary btn-sm" id="editPropertyBtn">
            ${IconService.createIcon('Edit')}
            Edit Property
          </button>
        ` : ''}
      </div>
    `;
  }
}