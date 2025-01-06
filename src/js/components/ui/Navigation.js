import { IconService } from '../../services/IconService.js';

export class Navigation {
  static renderBackButton() {
    return `
      <a href="/" class="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
        ${IconService.createIcon('ArrowLeft', { width: '16', height: '16' })}
        Back to Properties
      </a>
    `;
  }
}