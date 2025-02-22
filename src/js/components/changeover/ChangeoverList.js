import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { DateFilter } from '../changeover/DateFilter.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { CollapsibleSection } from '../ui/CollapsibleSection.js';
import { CollapsibleList } from '../ui/CollapsibleList.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class ChangeoverList {
  constructor(containerId, changeoverService) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error('Changeover list container not found');
    }

    this.changeoverService = changeoverService;
    if (!this.changeoverService) {
      throw new Error('Changeover service is required');
    }

    this.changeovers = [];
    this.selectedPropertyIds = null;
    this.initialize();
  }

  async initialize(propertyIds = null) {
    try {
      this.showLoading();
      this.selectedPropertyIds = propertyIds;
      this.changeovers = await this.changeoverService.getChangeovers(propertyIds);
      this.render();
    } catch (error) {
      console.error('Error loading changeovers:', error);
      this.showError(error.message);
    }
  }

  showLoading() {
    this.container.innerHTML = LoadingSpinner.render();
  }

  showError(message) {
    this.container.innerHTML = ErrorDisplay.render(message || 'Failed to load changeovers');
  }

  render() {
    const content = {
      headerContent: `
        <div class="d-flex justify-content-between align-items-center">
          <div id="dateFilterContainer"></div>
          <div>
            <button class="btn btn-primary btn-sm" id="scheduleChangeoverBtn">
              ${IconService.createIcon('Plus')}
              Add
            </button>
          </div>
        </div>
      `,
      body: this.renderChangeoversList()
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Changeovers',
      icon: 'Calendar',
      content,
      isCollapsed: CollapsibleSection.getStoredState('changeovers')
    });

    CollapsibleSection.attachEventListeners(this.container);
    CollapsibleList.attachEventListeners(this.container);
    
    // Initialize date filter if we have changeovers
    if (this.changeovers.length > 0) {
      this.dateFilter = new DateFilter('dateFilterContainer', (filter) => {
        this.applyDateFilter(filter);
      });
    }
    
    this.attachShareEventListeners();
  }

  applyDateFilter(filter) {
    let filteredChangeovers = [...this.changeovers];
    
    if (filter.startDate || filter.endDate) {
      filteredChangeovers = filteredChangeovers.filter(changeover => {
        const checkoutDate = new Date(changeover.checkout_date);
        
        if (filter.startDate && new Date(filter.startDate) > checkoutDate) {
          return false;
        }
        
        if (filter.endDate && new Date(filter.endDate) < checkoutDate) {
          return false;
        }
        
        return true;
      });
    }
    
    // Update the list content
    const listContent = this.container.querySelector('.list-content');
    if (listContent) {
      listContent.innerHTML = filteredChangeovers.map(changeover => 
        this.renderChangeoverItem(changeover)
      ).join('');
      
      // Reattach event listeners
      this.attachShareEventListeners();
    }
  }
  getStatusBadgeClass(status) {
    const classes = {
      scheduled: 'bg-info',
      in_progress: 'bg-warning',
      complete: 'bg-success'
    };
    return classes[status] || 'bg-secondary';
  }

  getStatusText(status) {
    const text = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      complete: 'Complete'
    };
    return text[status] || status;
  }

  attachShareEventListeners() {
    // Schedule changeover button
    const scheduleBtn = this.container.querySelector('#scheduleChangeoverBtn');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', () => {
        import('./ChangeoverModal.js').then(({ ChangeoverModal }) => {
          ChangeoverModal.show(this.changeoverService);
        });
      });
    }

    // Share button clicks
    this.container.querySelectorAll('.share-changeover').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault(); 
        const shareToken = btn.dataset.shareToken;
        const shareUrl = `${window.location.origin}/?token=${shareToken}`;
        
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          showErrorAlert('Share link copied to clipboard', 'success');
        } catch (error) {
          showErrorAlert('Failed to copy share link');
        }
      });
    });
  }

  renderChangeoversList() {
    // Filter out completed changeovers
    const activeChangeovers = this.changeovers.filter(c => c.status !== 'complete');

    return CollapsibleList.render({
      items: activeChangeovers,
      renderItem: (changeover) => this.renderChangeoverItem(changeover),
      emptyMessage: activeChangeovers.length === 0 ? 
        'No changeovers scheduled yet.' : 
        'No changeovers found for the selected criteria.',
      showMoreText: 'Show More Changeovers'
    });
  }

  renderChangeoverItem(changeover) {
    return `
      <div class="list-group-item mb-2">
        <a href="/?changeover=${changeover.id}" 
           class="d-flex justify-content-between align-items-start text-decoration-none text-dark">
          <div>
            <h6 class="mb-1">${changeover.property.name}</h6>
            <p class="mb-1 text-muted">
              ${IconService.createIcon('Calendar')}
              In: ${formatDate(changeover.checkin_date)} | 
              Out: ${formatDate(changeover.checkout_date)}
            </p>
            ${changeover.status === 'in_progress' ? `
              <span class="badge bg-warning">In Progress</span>
            ` : ''}
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm share-changeover" 
                    data-share-token="${changeover.share_token || ''}"
                    title="Share changeover"
                    onclick="event.stopPropagation(); event.preventDefault();">
              ${IconService.createIcon('Share2')}
              Share
            </button>
          </div>
        </a>
      </div>
    `;
  }
}