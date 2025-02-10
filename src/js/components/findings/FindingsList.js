import { FindingCard } from './FindingCard.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { IconService } from '../../services/IconService.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { formatDate } from '../../utils/dateUtils.js';
import { isVideo, renderMediaThumbnail } from '../../utils/mediaUtils.js';
import { CollapsibleSection } from '../ui/CollapsibleSection.js';
import { FindingModal } from './FindingModal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { supabase } from '../../lib/supabase.js';

export class FindingsList {
  constructor(containerId, findingsService, changeoverId) {
    console.debug('FindingsList: Constructor', { changeoverId });
    this.container = document.getElementById(containerId);
    this.currentView = localStorage.getItem('findings-view') || 'list'; // Default to list view
    if (!this.container) {
      throw new Error('Findings list container not found');
    }

    this.findingsService = findingsService;
    if (!this.findingsService) {
      throw new Error('Findings service is required');
    }

    this.changeoverId = changeoverId;
    if (!this.changeoverId) {
      throw new Error('Changeover ID is required');
    }

    this.findings = [];
    this.statusFilter = null;
    this.pollingInterval = null;
    this.statusSubscription = null;
    this.initialize();
  }

  async initialize() {
    try {
      this.showLoading();
      console.debug('FindingsList: Initializing', { 
        changeoverId: this.changeoverId 
      });

      // Get initial findings
      this.findings = await this.findingsService.getFindings(this.changeoverId);
      console.debug('FindingsList: Initial findings loaded', { count: this.findings.length });

      // Subscribe to status changes
      const channelName = `public:changeovers:id=eq.${this.changeoverId}`;
      this.statusSubscription = supabase
        .channel(channelName)
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'changeovers',
            filter: `id=eq.${this.changeoverId}`,
            properties: ['status']
          },
          (payload) => {
            console.debug('FindingsList: Status change detected', {
              changeoverId: this.changeoverId,
              oldStatus: payload.old.status,
              newStatus: payload.new.status
            });

            // Start/stop polling based on new status
            if (payload.new.status === 'in_progress') {
              console.debug('FindingsList: Starting polling due to status change');
              this.startPolling();
            } else {
              console.debug('FindingsList: Stopping polling due to status change');
              this.stopPolling();
            }
          }
        )
        .subscribe();

      console.debug('FindingsList: Status subscription created', {
        changeoverId: this.changeoverId,
        channel: channelName,
        subscription: this.statusSubscription
      });
      this.render();
    } catch (error) {
      console.error('Error loading findings:', error);
      this.showError(error.message);
    }
  }

  startPolling() {
    console.debug('FindingsList: Starting polling');

    // Clear any existing polling
    this.stopPolling();
    
    // Poll every 5 seconds for new findings
    this.pollingInterval = setInterval(async () => {
      console.debug('FindingsList: Polling for new findings');

      try {
        const newFindings = await this.findingsService.getFindings(this.changeoverId);
        console.debug('FindingsList: Poll results', {
          currentCount: this.findings.length,
          newCount: newFindings.length
        });
        
        // Check if we have new findings
        if (newFindings.length > this.findings.length) {
          console.debug('FindingsList: New findings detected', {
            oldCount: this.findings.length,
            newCount: newFindings.length
          });
          
          this.findings = newFindings;
          this.render();
        }
      } catch (error) {
        console.error('Error polling for findings:', error);
        // Stop polling on error to prevent spam
        this.stopPolling();
      }
    }, 5000); // Poll every 5 seconds

    console.debug('FindingsList: Polling started', { 
      interval: this.pollingInterval 
    });
  }

  stopPolling() {
    if (this.pollingInterval) {
      console.debug('FindingsList: Stopping polling');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  showLoading() {
    this.container.innerHTML = LoadingSpinner.render();
  }

  showError(message) {
    this.container.innerHTML = ErrorDisplay.render(message || 'Failed to load findings');
  }

  render() {
    const content = {
      headerContent: `
        <div class="d-flex align-items-center gap-3 justify-content-between flex-wrap">
          <select class="form-select form-select-sm" id="statusFilter" style="width: auto;">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="open">Open</option>
            <option value="blocked">Blocked</option>
            <option value="wont_fix">Won't Fix</option>
            <option value="fixed">Fixed</option>
          </select>
          <div class="btn-group">
            <button type="button" class="btn btn-sm view-toggle" data-view="list" title="List View">
              ${IconService.createIcon('List', { width: '16', height: '16' })}
            </button>
            <button type="button" class="btn btn-sm view-toggle" data-view="grid" title="Grid View">
              ${IconService.createIcon('Grid', { width: '16', height: '16' })}
            </button>
          </div>
        </div>
      `,
      body: this.renderFindingsList()
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Findings',
      icon: 'Search',
      content,
      isCollapsed: CollapsibleSection.getStoredState('findings')
    });

    // Set initial view
    this.currentView = localStorage.getItem('findings-view') || 'list';
    this.setActiveView(this.currentView);

    CollapsibleSection.attachEventListeners(this.container);
    this.attachEventListeners();
  }

  setActiveView(view) {
    this.container.querySelectorAll('.view-toggle').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
      btn.classList.toggle('btn-outline-secondary', btn.dataset.view !== view);
      if (btn.dataset.view === view) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline-secondary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-secondary'); 
      }
    });
  }

  renderFindingsList() {
    const filteredFindings = this.statusFilter
      ? this.findings.filter(f => f.status === this.statusFilter)
      : this.findings;

    if (!filteredFindings?.length) {
      return `
        <div class="card-body">
          <div class="alert alert-info mb-0">
            ${this.findings.length ? 'No findings match the selected filter.' : 'No findings have been reported yet.'}
          </div>
        </div>
      `;
    }
    
    return this.currentView === 'list' ? this.renderListView(filteredFindings) : this.renderGridView(filteredFindings);
  }

  renderListView(filteredFindings) {
    return `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Status</th>
              <th>Description</th>
              <th>Property</th>
              <th>Location</th>
              <th>Item</th>
              <th>Date Found</th>
            </tr>
          </thead>
          <tbody>
            ${filteredFindings.map(finding => `
              <tr class="finding-item" data-finding-id="${finding.id}" style="cursor: pointer">
                <td>${StatusBadge.render(finding.status)}</td>
                <td>
                  ${finding.description}
                </td>
                <td>${finding.changeover?.property?.name || '-'}</td>
                <td>${finding.location}</td>
                <td>${finding.content_item ? finding.content_item.name : '-'}</td>
                <td>${formatDate(finding.date_found)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderGridView(filteredFindings) {
    return `
      <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
        ${filteredFindings.map(finding => `
          <div class="col finding-item" data-finding-id="${finding.id}">
            ${FindingCard.render(finding)}
          </div>
        `).join('')}
      </div>
    `;
  }

  attachEventListeners() {
    // Status filter
    const statusFilter = this.container.querySelector('#statusFilter');
    if (statusFilter) {
      // Prevent click propagation
      statusFilter.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      // Handle change event
      statusFilter.addEventListener('change', (e) => {
        e.stopPropagation();
        this.statusFilter = e.target.value || null;
        this.render();
        
        // Maintain filter value after render
        const newFilter = this.container.querySelector('#statusFilter');
        if (newFilter) {
          newFilter.value = this.statusFilter || '';
        }
      });
    }

    // View toggle
    this.container.querySelectorAll('.view-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.dataset.view;
        this.currentView = view;
        localStorage.setItem('findings-view', view);
        this.render();
      });
    });

    this.container.querySelectorAll('.finding-item').forEach(item => {
      item.addEventListener('click', () => {
        const findingId = item.dataset.findingId;
        const finding = this.findings.find(f => f.id === findingId);
        if (finding) {
          // Pass findingsService instance to modal
          FindingModal.show(
            finding,
            this.findingsService,
            async (findingId, status) => this.handleUpdateStatus(findingId, status),
            async (findingId, text) => this.handleAddNote(findingId, text)
          );
        }
      });
    });
  }

  async handleUpdateStatus(findingId, status) {
    try {
      await this.findingsService.updateStatus(findingId, status);
      await this.initialize();
      showErrorAlert('Status updated successfully', 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showErrorAlert('Failed to update status. Please try again.');
    }
  }

  async handleAddNote(findingId, text) {
    try {
      await this.findingsService.addNote(findingId, text);
    } catch (error) {
      console.error('Error adding note:', error);
      showErrorAlert('Failed to add note. Please try again.');
    }
  }

  refresh() {
    // Stop any existing polling
    this.stopPolling();
    console.debug('FindingsList: Refreshing findings');
    this.initialize();
  }

  // Clean up when component is destroyed
  destroy() {
    console.debug('FindingsList: Destroying component');
    // Clean up subscription
    try {
      if (this.statusSubscription) {
        console.debug('FindingsList: Unsubscribing from status changes');
        this.statusSubscription.unsubscribe().then(() => {
          console.debug('FindingsList: Successfully unsubscribed');
        }).catch(error => {
          console.error('FindingsList: Error unsubscribing', error);
        });
      }
    } catch (error) {
      console.error('FindingsList: Error unsubscribing', error);
    }
    this.stopPolling();
  }
}