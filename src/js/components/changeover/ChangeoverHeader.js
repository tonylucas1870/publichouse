import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { Navigation } from '../ui/Navigation.js';

export class ChangeoverHeader {
  constructor(containerId, changeoverService, changeoverId) {
    this.container = document.getElementById(containerId);
    this.changeoverService = changeoverService;
    this.changeoverId = changeoverId;
    this.initialize();
  }

  async initialize() {
    try {
      const changeover = await this.changeoverService.getChangeover(this.changeoverId);
      if (!changeover) {
        throw new Error('Changeover not found');
      }
      this.render(changeover);
    } catch (error) {
      console.error('Error loading changeover:', error);
      this.showError();
    }
  }

  render(changeover) {
    this.container.innerHTML = `
      <div class="mb-4">
        ${Navigation.renderBackButton()}
        <h2 class="h4 my-3">${changeover.property.name}</h2>
        <p class="text-muted d-flex align-items-center gap-2">
          ${IconService.createIcon('Calendar')}
          Check-in: ${formatDate(changeover.checkin_date)} | 
          Check-out: ${formatDate(changeover.checkout_date)}
        </p>
      </div>
    `;
  }

  showError() {
    this.container.innerHTML = `
      <div class="mb-4">
        ${Navigation.renderBackButton()}
        <div class="alert alert-danger mt-3">
          Failed to load changeover details.
        </div>
      </div>
    `;
  }
}