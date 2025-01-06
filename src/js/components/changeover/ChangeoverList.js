import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
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
      headerContent: '',
      body: this.renderChangeoversList()
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Scheduled Changeovers',
      icon: 'Calendar',
      content,
      isCollapsed: CollapsibleSection.getStoredState('changeovers')
    });

    CollapsibleSection.attachEventListeners(this.container);
    CollapsibleList.attachEventListeners(this.container);
    this.attachShareEventListeners();
  }

  attachShareEventListeners() {
    // Share button clicks
    this.container.querySelectorAll('.share-changeover').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const shareToken = btn.dataset.shareToken;
        const shareUrl = `${window.location.origin}/?token=${shareToken}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
          showErrorAlert('Share link copied to clipboard', 'success');
        }).catch(() => {
          showErrorAlert('Failed to copy share link');
        });
      });
    });
  }

  renderChangeoversList() {
    return CollapsibleList.render({
      items: this.changeovers,
      renderItem: (changeover) => this.renderChangeoverItem(changeover),
      emptyMessage: this.changeovers.length === 0 ? 
        'No changeovers scheduled yet.' : 
        'No changeovers found for the selected criteria.',
      showMoreText: 'Show More Changeovers'
    });
  }

  renderChangeoverItem(changeover) {
    return `
      <div class="list-group-item mb-2">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h6 class="mb-1">${changeover.property.name}</h6>
            <p class="mb-1 text-muted">
              ${IconService.createIcon('Calendar')}
              Checkin: ${formatDate(changeover.checkin_date)} | 
              Checkout: ${formatDate(changeover.checkout_date)}
            </p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm share-changeover"
                    data-share-token="${changeover.share_token}"
                    title="Share changeover">
              ${IconService.createIcon('Share2')}
              Share
            </button>
            <a href="/?changeover=${changeover.id}" 
               class="btn btn-outline-primary btn-sm">
              View Findings
            </a>
          </div>
        </div>
      </div>
    `;
  }
}