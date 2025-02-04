import { IconService } from '../../services/IconService.js';
import { getStatusConfig } from '../../utils/statusUtils.js';

export class StatusBadge {
  static render(status) {
    const config = getStatusConfig(status);
    
    return `<span class="badge ${config.class} py-2 px-3">${config.text}</span>`;
  }
}