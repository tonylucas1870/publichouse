import { IconService } from '../../services/IconService.js';

export class CollapsibleSection {
  static render({ title, icon, content, headerClass = 'bg-primary bg-opacity-10', isCollapsed = false }) {
    // Generate a stable ID based on title
    const id = this.getSectionId(title);
    const storedState = this.getStoredState(id);
    const finalIsCollapsed = isCollapsed || storedState;
    
    console.debug('CollapsibleSection: Rendering section', {
      title,
      id,
      isCollapsed,
      storedState,
      finalIsCollapsed
    });
    
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
                    aria-expanded="${!finalIsCollapsed}"
                    style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
              ${IconService.createIcon(finalIsCollapsed ? 'ChevronDown' : 'ChevronUp')}
            </button>
          </div>
        </div>
        <div class="section-content" id="${id}" style="display: ${finalIsCollapsed ? 'none' : 'block'}">
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
        e.preventDefault();
        e.stopPropagation();
        const sectionId = btn.getAttribute('data-section');
        const content = document.getElementById(sectionId);
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        
        console.debug('CollapsibleSection: Toggle clicked', {
          sectionId,
          currentlyExpanded: isExpanded,
          hasContent: !!content
        });
        
        if (!content) {
          console.error('CollapsibleSection: Content element not found', { sectionId });
          return;
        }
        
        // Toggle content
        content.style.display = isExpanded ? 'none' : 'block';
        
        // Update button
        btn.setAttribute('aria-expanded', !isExpanded);
        btn.innerHTML = IconService.createIcon(isExpanded ? 'ChevronDown' : 'ChevronUp');

        // Save state to localStorage
        localStorage.setItem(`section-${sectionId}`, isExpanded);
        
        console.debug('CollapsibleSection: Saved state', { 
          sectionId,
          storageKey: `section-${sectionId}`,
          isCollapsed: isExpanded,
          allKeys: Object.keys(localStorage).filter(key => key.startsWith('section-'))
        });
      });
    });
  }

  static getStoredState(sectionId) {
    if (!sectionId) {
      console.error('CollapsibleSection: No section ID provided');
      return false;
    }
    
    const storageKey = `section-${sectionId}`;
    const storedValue = localStorage.getItem(storageKey);

    console.debug('CollapsibleSection: Getting stored state', {
      sectionId,
      storageKey,
      storedValue,
      allKeys: Object.keys(localStorage).filter(key => key.startsWith('section-'))
    });
    
    return storedValue === 'true';
  }

  // Helper to ensure consistent ID generation
  static getSectionId(title) {
    if (!title) {
      console.error('CollapsibleSection: No title provided for ID generation');
      return 'unknown-section';
    }
    
    const id = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
      
    console.debug('CollapsibleSection: Generated section ID', {
      title,
      id
    });
    
    return id;
  }
}