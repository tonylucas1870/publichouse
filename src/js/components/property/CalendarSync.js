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
        <div class="alert alert-info d-flex align-items-center gap-2 mb-0">
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
          <div>
            <div>Calendar Connected</div>
            ${this.property?.calendar_sync_status ? `
              <small class="text-muted">
                ${this.property.calendar_sync_status === 'synced' ? 
                  `Last synced: ${this.property.calendar_last_synced ? new Date(this.property.calendar_last_synced).toLocaleString() : 'Never'}` :
                  `Status: ${this.property.calendar_sync_status}`}
                ${this.property.calendar_sync_error ? 
                  `<br>Error: ${this.property.calendar_sync_error}` : ''}
              </small>
            ` : ''}
          </div>
        </div>
        ${isAdmin ? `
        <button class="btn btn-outline-primary btn-sm" id="syncCalendarBtn" ${this.isSyncing ? 'disabled' : ''}>
          ${this.isSyncing ? `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Syncing...
          ` : `
            ${IconService.createIcon('Sync')}
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

    console.debug('CalendarSync: Starting sync', { url: this.calendarUrl });

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
      console.debug('CalendarSync: Fetched bookings', { count: bookings.length });

      // Sync with database
      await this.calendarService.syncPropertyCalendar(this.propertyId, bookings);

      // Refresh property data to get updated sync status
      const { data: property } = await supabase
        .from('properties')
        .select('calendar_sync_status, calendar_last_synced, calendar_sync_error')
        .eq('id', this.propertyId)
        .single();

      if (property) {
        this.property = property;
      }

      showErrorAlert('Calendar synced successfully', 'success');
    } catch (error) {
      console.error('CalendarSync: Sync failed', error);
      DebugLogger.error('CalendarSync', 'Sync failed', error);
      showErrorAlert(error.message || 'Failed to sync calendar');
    } finally {
      this.isSyncing = false;
      this.render();
    }
  }

  initialize() {
    // Get initial property status
    supabase
      .from('properties')
      .select('calendar_sync_status, calendar_last_synced, calendar_sync_error')
      .eq('id', this.propertyId)
      .single()
      .then(({ data }) => {
        if (data) {
          this.property = data;
          this.render();
        }
      })
      .catch(error => {
        console.error('Error getting property sync status:', error);
      });
  }
}