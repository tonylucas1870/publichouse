import { IconService } from '../../services/IconService.js';
import { CalendarService } from '../../services/CalendarService.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { isValidCalendarUrl } from '../../utils/calendarUtils.js';
import { DebugLogger } from '../../utils/debugUtils.js';

export class CalendarSync {
  constructor(containerId, propertyId, calendarUrl) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Calendar sync container not found');
      return;
    }

    this.propertyId = propertyId;
    this.calendarUrl = calendarUrl;
    this.calendarService = new CalendarService();
    this.isSyncing = false;
    this.initialize();
  }

  render() {
    const isAdmin = this.container.dataset.isAdmin === 'true';
    if (!this.calendarUrl) {
      this.container.innerHTML = `
        <div class="alert alert-warning d-flex align-items-center gap-2 mb-0">
          ${IconService.createIcon('Calendar')}
          No calendar URL configured
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-2">
          ${IconService.createIcon('Calendar')}
          <span>Calendar Connected</span>
        </div>
        ${isAdmin ? `
        <button class="btn btn-outline-primary btn-sm" id="syncCalendarBtn" ${this.isSyncing ? 'disabled' : ''}>
          ${this.isSyncing ? `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Syncing...
          ` : `
            ${IconService.createIcon('Refresh')}
            Sync Now
          `}
        </button>
        ` : ''}
      </div>
    `;

    // Attach event listeners
    const syncBtn = this.container.querySelector('#syncCalendarBtn');
    if (syncBtn && !this.isSyncing) {
      syncBtn.addEventListener('click', () => this.handleSync());
    }
  }

  async handleSync() {
    if (this.isSyncing) return;

    try {
      DebugLogger.log('CalendarSync', 'Starting sync', { url: this.calendarUrl });

      // Validate URL
      if (!isValidCalendarUrl(this.calendarUrl)) {
        throw new Error('Invalid calendar URL');
      }

      // Show syncing state
      this.isSyncing = true;
      this.render();

      // Fetch and parse calendar data
      const bookings = await this.calendarService.fetchCalendarData(this.calendarUrl);
      
      DebugLogger.log('CalendarSync', 'Fetched bookings', { 
        count: bookings.length,
        firstBooking: bookings[0] 
      });

      // Sync with database
      await this.calendarService.syncPropertyCalendar(this.propertyId, bookings);

      showErrorAlert('Calendar synced successfully', 'success');
    } catch (error) {
      DebugLogger.error('CalendarSync', 'Sync failed', error);
      showErrorAlert(error.message || 'Failed to sync calendar');
    } finally {
      this.isSyncing = false;
      this.render();
    }
  }

  initialize() {
    this.render();
  }
}