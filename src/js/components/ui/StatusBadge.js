import { IconService } from '../../services/IconService.js';
import { getStatusConfig } from '../../utils/statusUtils.js';

export class StatusBadge {
  static render(status) {
    const config = getStatusConfig(status);
    
    return `
      <span class="badge ${config.class} d-flex align-items-center gap-1 py-2 px-3">
        ${IconService.createIcon(config.icon, { width: '16', height: '16' })}
        ${config.text}
      </span>
    `;
  }
}