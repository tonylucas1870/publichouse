import { IconService } from '../../services/IconService.js';

export class CollapsibleSection {
  static render({ title, icon, content, headerClass = 'bg-primary bg-opacity-10', isCollapsed = false }) {
    const id = `section-${Math.random().toString(36).substr(2, 9)}`;
    
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
                    data-section="${id}"
                    aria-expanded="${!isCollapsed}">
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
        const sectionId = btn.dataset.section;
        const content = document.getElementById(sectionId);
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        
        // Toggle content
        content.style.display = isExpanded ? 'none' : 'block';
        
        // Update button
        btn.setAttribute('aria-expanded', !isExpanded);
        btn.innerHTML = IconService.createIcon(isExpanded ? 'ChevronDown' : 'ChevronUp');
        
        // Save state to localStorage
        localStorage.setItem(`section-${sectionId}-collapsed`, isExpanded);
      });
    });
  }

  static getStoredState(sectionId) {
    return localStorage.getItem(`section-${sectionId}-collapsed`) === 'true';
  }
}