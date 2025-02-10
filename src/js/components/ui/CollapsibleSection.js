import { IconService } from '../../services/IconService.js';

export class CollapsibleSection {
  static render({ title, icon, content, headerClass = 'bg-primary bg-opacity-10', isCollapsed = false }) {
    // Generate a stable ID based on the title
    const id = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    return `
      <div class="card mb-4">
        <div class="card-header ${headerClass} d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            ${icon ? IconService.createIcon(icon) : ''}
            <h3 class="h5 mb-0">${title}</h3>
          </div>
          <div class="d-flex align-items-center gap-2">
            ${this.renderHeaderContent(content.headerContent)}
            <button class="btn btn-link btn-sm p-0 text-muted toggle-section" 
                    data-section-id="${id}"
                    aria-expanded="${!isCollapsed}"
                    style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
              ${IconService.createIcon(isCollapsed ? 'ChevronDown' : 'ChevronUp')}
            </button>
          </div>
        </div>
        <div class="section-content" id="${id}" style="display: ${isCollapsed ? 'none' : 'block'}">
          ${content.body}
        </div>
      </div>
    `;
  }

  static renderHeaderContent(content) {
    return content || '';
  }

  static attachEventListeners(container) {
    container.querySelectorAll('.toggle-section').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sectionId = btn.dataset.sectionId;
        const content = document.getElementById(sectionId);
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        
        // Toggle content
        content.style.display = isExpanded ? 'none' : 'block';
        
        // Update button
        btn.setAttribute('aria-expanded', !isExpanded);
        btn.innerHTML = IconService.createIcon(isExpanded ? 'ChevronDown' : 'ChevronUp');

        // Save state to localStorage
        const storageKey = `section-collapsed-${sectionId}`;
        localStorage.setItem(storageKey, isExpanded);
        console.debug('CollapsibleSection: Saved state', { 
          sectionId,
          storageKey,
          isCollapsed: isExpanded
        });
      });
    });
  }

  static getStoredState(sectionId) {
    const storageKey = `section-collapsed-${sectionId}`;
    const storedValue = localStorage.getItem(storageKey);
    console.debug('CollapsibleSection: Getting stored state', {
      sectionId,
      storageKey,
      storedValue
    });
    return storedValue === 'true';
  }
}