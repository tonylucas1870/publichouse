import { IconService } from '../../services/IconService.js';

export class PropertyForm {
  static render(property) {
    return `
      <form id="propertyForm">
        <div class="mb-3">
          <label for="propertyName" class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('Home')}
            Property Name
          </label>
          <input type="text" class="form-control" id="propertyName" 
                 value="${property.name}" required>
        </div>
        <div class="mb-3">
          <label for="propertyAddress" class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('MapPin')}
            Address
          </label>
          <textarea class="form-control" id="propertyAddress" rows="2" 
                    required>${property.address}</textarea>
        </div>
        <div class="mb-3">
          <label for="calendarUrl" class="form-label d-flex align-items-center gap-2">
            ${IconService.createIcon('Calendar')}
            Calendar URL (Optional)
          </label>
          <input type="url" class="form-control" id="calendarUrl" 
                 value="${property.calendar_url || ''}">
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-outline-secondary" id="cancelEditBtn">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            Save Changes
          </button>
        </div>
      </form>
    `;
  }
}