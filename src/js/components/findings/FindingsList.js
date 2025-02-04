import { FindingCard } from './FindingCard';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { FindingModal } from './FindingModal';
import { showErrorAlert } from '../../utils/alertUtils';

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
    this.statusFilter = null;
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
      headerContent: `
        <div class="d-flex align-items-center gap-2" onclick="event.stopPropagation()">
          <select class="form-select form-select-sm" id="statusFilter" style="width: auto;">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="open">Open</option>
            <option value="blocked">Blocked</option>
            <option value="wont_fix">Won't Fix</option>
            <option value="fixed">Fixed</option>
          </select>
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

    CollapsibleSection.attachEventListeners(this.container);
    this.attachEventListeners();
  }

  renderFindingsList() {
    const filteredFindings = this.statusFilter
      ? this.findings.filter(f => f.status === this.statusFilter)
      : this.findings;

    if (!filteredFindings?.length) {
      return `
        <div class="card-body">
          <div class="alert alert-info mb-0">
            ${this.findings.length ? 'No findings match the selected filter.' : 'No findings reported yet.'}
          </div>
        </div>
      `;
    }

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
    this.initialize();
  }
}