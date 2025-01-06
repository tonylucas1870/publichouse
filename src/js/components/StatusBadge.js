import { IconService } from '../services/IconService.js';
import { getStatusText } from '../utils/statusUtils.js';

export class StatusBadge {
  static render(status) {
    return `
      <span class="status-badge ${status}">
        ${IconService.getStatusIcon(status)}
        <span class="ms-1">${getStatusText(status)}</span>
      </span>
    `;
  }
}