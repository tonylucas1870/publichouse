import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { FindingModal } from './FindingModal.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { CollapsibleSection } from '../ui/CollapsibleSection.js';
import { CollapsibleList } from '../ui/CollapsibleList.js';
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
      this.findings = await this.findingsService.getPendingFindings();
      this.applyPropertyFilter();
      
      // Only render if we have findings
      if (this.findings.length > 0) {
        this.container.style.display = 'block';
        this.render();
      } else {
        this.container.style.display = 'none';
      }
    } catch (error) {
      console.error('Error loading pending findings:', error);
      // Hide the section on error
      this.container.style.display = 'none';
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
      body: CollapsibleList.render({
        items: this.filteredFindings,
        renderItem: (finding) => this.renderFindingItem(finding),
        emptyMessage: 'No pending findings',
        showMoreText: 'Show More Findings'
      })
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Pending Findings',
      icon: 'Clock',
      content,
      headerClass: 'bg-warning bg-opacity-10',
      isCollapsed: CollapsibleSection.getStoredState('pending-findings')
    });

    CollapsibleSection.attachEventListeners(this.container);
    CollapsibleList.attachEventListeners(this.container);
    this.attachEventListeners();
  }

  renderFindingItem(finding) {
    // Get the first image from the images array for the thumbnail
    const thumbnailImage = finding.images?.[0];
    const hasMultipleImages = finding.images?.length > 1;

    return `
      <div class="list-group-item finding-item mb-2" data-finding-id="${finding.id}" style="cursor: pointer">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="mb-1">${finding.description}</h6>
            <p class="mb-1 text-muted small">
              ${IconService.createIcon('MapPin', { width: '14', height: '14' })}
              ${finding.location} at ${finding.changeover?.property?.name || 'Unknown Property'}
            </p>
            <small class="text-muted d-flex align-items-center gap-1">
              ${IconService.createIcon('Clock', { width: '14', height: '14' })}
              Found ${formatDate(finding.date_found)}
            </small>
          </div>
          <div class="position-relative">
            <img 
              src="${thumbnailImage}" 
              alt="Finding thumbnail" 
              class="rounded" 
              style="width: 60px; height: 60px; object-fit: cover"
            >
            ${hasMultipleImages ? `
              <span class="position-absolute top-0 end-0 badge bg-dark bg-opacity-75" 
                    style="transform: translate(25%, -25%)">
                +${finding.images.length - 1}
              </span>
            ` : ''}
          </div>
        </div>
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

  refresh() {
    if (authStore.isAuthenticated()) {
      this.initialize();
    }
  }
}