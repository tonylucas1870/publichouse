import { IconService } from '../../services/IconService.js';

export class CalendarStatus {
  static render(calendarUrl) {
    const isConnected = !!calendarUrl;
    
    return `
      <div class="mt-3 d-flex align-items-center gap-2 ${isConnected ? 'text-success' : 'text-muted'}">
        ${IconService.createIcon('Calendar')}
        ${isConnected ? 'Calendar Connected' : 'Calendar Not Connected'}
      </div>
    `;
  }
}