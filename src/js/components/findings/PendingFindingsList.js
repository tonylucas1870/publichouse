import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { FindingModal } from './FindingModal.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { CollapsibleSection } from '../ui/CollapsibleSection.js';
import { CollapsibleList } from '../ui/CollapsibleList.js';
import { isVideo, renderMediaThumbnail } from '../../utils/mediaUtils.js';
import { authStore } from '../../auth/AuthStore.js';

export class PendingFindingsList {
  constructor(containerId, findingsService) {
    this.container = document.getElementById(containerId);
    this.findingsService = findingsService;
    this.findings = [];
    this.filteredFindings = [];
    this.selectedPropertyId = null;
    
    // Only initialize if user is authenticated
    if (authStore.isAuthenticated()) {
      this.initialize();
    } else {
      this.container.style.display = 'none';
    }
  }

  async initialize() {
    try {
      this.showLoading();
      // Set initial view before loading data
      this.currentView = localStorage.getItem('findings-view') || 'grid';
      
      this.findings = await this.findingsService.getOpenFindings() || [];
      this.applyPropertyFilter();
      
      // Only render if we have findings
      if (this.findings.length > 0) {
        this.container.style.display = 'block';
        this.render();
      } else {
        this.container.style.display = 'none';
      }
      return true;
    } catch (error) {
      console.error('Error loading pending findings:', error);
      // Hide the section on error
      this.container.style.display = 'none';
      return false;
    }
  }

  applyPropertyFilter() {
    if (!this.selectedPropertyId) {
      this.filteredFindings = [...this.findings];
      return;
    }

    this.filteredFindings = this.findings.filter(finding => 
      finding.changeover?.property?.id === this.selectedPropertyId
    );
  }

  setSelectedProperty(propertyId) {
    this.selectedPropertyId = propertyId;
    this.applyPropertyFilter();
    
    if (this.findings.length > 0) {
      this.render();
    }
  }

  showLoading() {
    this.container.innerHTML = LoadingSpinner.render();
  }

  render() {
    const content = {
      headerContent: `
        <div class="d-flex align-items-center gap-2 justify-content-between flex-wrap">
          <div class="btn-group">
            <button type="button" class="btn btn-sm view-toggle ${this.currentView === 'list' ? 'active btn-primary' : 'btn-outline-secondary'}" data-view="list" title="List View">
              ${IconService.createIcon('List', { width: '16', height: '16' })}
            </button>
            <button type="button" class="btn btn-sm view-toggle ${this.currentView === 'grid' ? 'active btn-primary' : 'btn-outline-secondary'}" data-view="grid" title="Grid View">
              ${IconService.createIcon('Grid', { width: '16', height: '16' })}
            </button>
          </div>
        </div>
      `,
      body: this.renderFindingsList()
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Findings Needing Attention',
      icon: 'Clock',
      content,
      headerClass: 'bg-warning bg-opacity-10',
      isCollapsed: CollapsibleSection.getStoredState('pending-findings')
    });

    CollapsibleSection.attachEventListeners(this.container);
    CollapsibleList.attachEventListeners(this.container);
    
    this.attachEventListeners();
  }

  renderFindingsList() {
    if (!this.filteredFindings?.length) {
      return `
        <div class="card-body">
          <div class="alert alert-info mb-0">
            ${this.findings.length ? 'No findings match the selected filter.' : 'No findings need attention.'}
          </div>
        </div>
      `;
    }

    return this.currentView === 'list' ? this.renderListView(this.filteredFindings) : this.renderGridView(this.filteredFindings);
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
            <div class="card h-100">
              ${this.renderFindingCard(finding)}
            </div>
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

    // View toggle
    this.container.querySelectorAll('.view-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const view = btn.dataset.view;
        localStorage.setItem('findings-view', view);
        console.debug('PendingFindingsList: View changed', { view });
        this.currentView = view;
        this.render();
      });
    });
  }

  async handleUpdateStatus(findingId, status) {
    try {
      await this.findingsService.updateStatus(findingId, status);
      await this.initialize(); // Refresh the list
      showErrorAlert('Status updated successfully', 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showErrorAlert('Failed to update status. Please try again.');
    }
  }

  async handleAddNote(findingId, text) {
    try {
      await this.findingsService.addNote(findingId, text);
      await this.initialize(); // Refresh the list
    } catch (error) {
      console.error('Error adding note:', error);
      showErrorAlert('Failed to add note. Please try again.');
    }
  }

  renderFindingCard(finding) {
    return `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-3">
          ${StatusBadge.render(finding.status)}
          <small class="text-muted">${formatDate(finding.date_found)}</small>
        </div>
        <p class="card-text">${finding.description}</p>
        <p class="card-text text-muted d-flex align-items-center gap-1">
          ${IconService.createIcon('Building', { width: '16', height: '16' })}
          ${finding.changeover?.property?.name || '-'}
        </p>
        <p class="card-text text-muted d-flex align-items-center gap-1">
          ${IconService.createIcon('MapPin', { width: '16', height: '16' })}
          ${finding.location}
        </p>
        ${finding.content_item ? `
          <p class="card-text text-muted d-flex align-items-center gap-1">
            ${IconService.createIcon('Sofa', { width: '16', height: '16' })}
            ${finding.content_item.name}
          </p>
        ` : ''}
      </div>
    `;
  }

  refresh() {
    if (authStore.isAuthenticated()) {
      this.initialize();
    }
  }
}