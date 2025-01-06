import { FindingCard } from './FindingCard.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { CollapsibleSection } from '../ui/CollapsibleSection.js';
import { FindingModal } from './FindingModal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class FindingsList {
  constructor(containerId, findingsService, changeoverId) {
    this.container = document.getElementById(containerId);
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
    this.initialize();
  }

  async initialize() {
    try {
      this.showLoading();
      this.findings = await this.findingsService.getFindings(this.changeoverId);
      this.render();
    } catch (error) {
      console.error('Error loading findings:', error);
      this.showError(error.message);
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
      body: this.renderFindingsList()
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Findings',
      icon: 'Search',
      content,
      isCollapsed: CollapsibleSection.getStoredState('findings')
    });

    CollapsibleSection.attachEventListeners(this.container);
    this.attachEventListeners();
  }

  renderFindingsList() {
    if (!this.findings?.length) {
      return `
        <div class="card-body">
          <div class="alert alert-info mb-0">
            No findings reported yet.
          </div>
        </div>
      `;
    }

    return `
      <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
        ${this.findings.map(finding => `
          <div class="col finding-item" data-finding-id="${finding.id}">
            ${FindingCard.render(finding)}
          </div>
        `).join('')}
      </div>
    `;
  }

  attachEventListeners() {
    this.container.querySelectorAll('.finding-item').forEach(item => {
      item.addEventListener('click', () => {
        const findingId = item.dataset.findingId;
        const finding = this.findings.find(f => f.id === findingId);
        if (finding) {
          FindingModal.show(
            finding,
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
      await this.initialize();
    } catch (error) {
      console.error('Error adding note:', error);
      showErrorAlert('Failed to add note. Please try again.');
    }
  }

  refresh() {
    this.initialize();
  }
}