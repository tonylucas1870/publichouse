import { IconService } from '../../services/IconService.js';
import { Modal } from '../ui/Modal.js';
import { formatDate } from '../../utils/dateUtils.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { FindingModal } from '../findings/FindingModal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class ContentItemFindings {
  static async show(contentItem, findingsService) {
    try {
      // Get all findings
      const relatedFindings = await findingsService.getFindingsByContentItem(contentItem.name);

      const { modal, closeModal } = Modal.show({
        title: `Findings for ${contentItem.name}`,
        size: 'large',
        content: `
          <div class="list-group list-group-flush">
            ${relatedFindings.length ? relatedFindings.map(finding => `
              <div class="list-group-item finding-item" data-finding-id="${finding.id}">
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <div class="d-flex align-items-center gap-2 mb-2">
                      ${StatusBadge.render(finding.status)}
                      <small class="text-muted">${formatDate(finding.date_found)}</small>
                    </div>
                    <p class="mb-1">${finding.description}</p>
                    <small class="text-muted d-flex align-items-center gap-1">
                      ${IconService.createIcon('MapPin', { width: '14', height: '14' })}
                      ${finding.location}
                    </small>
                  </div>
                  <div class="ms-3">
                    <img 
                      src="${finding.images[0]?.url || finding.images[0]}" 
                      alt="Finding thumbnail" 
                      class="rounded" 
                      style="width: 60px; height: 60px; object-fit: cover"
                    >
                  </div>
                </div>
              </div>
            `).join('') : `
              <div class="text-center p-4 text-muted">
                No findings reported for this item yet
              </div>
            `}
          </div>
        `
      });

      // Attach click handlers for findings
      modal.querySelectorAll('.finding-item').forEach(item => {
        item.addEventListener('click', () => {
          const findingId = item.dataset.findingId;
          const finding = relatedFindings.find(f => f.id === findingId);
          if (finding) {
            closeModal();
            FindingModal.show(
              finding,
              findingsService,
              async (findingId, status) => {
                await findingsService.updateStatus(findingId, status);
                // Reopen findings modal with refreshed data
                ContentItemFindings.show(contentItem, findingsService);
              },
              async (findingId, text) => {
                await findingsService.addNote(findingId, text);
                // Reopen findings modal with refreshed data
                ContentItemFindings.show(contentItem, findingsService);
              }
            );
          }
        });
      });

    } catch (error) {
      console.error('Error showing content item findings:', error);
      showErrorAlert('Failed to load findings');
    }
  }
}