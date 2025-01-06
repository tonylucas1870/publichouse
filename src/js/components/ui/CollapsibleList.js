import { IconService } from '../../services/IconService.js';

export class CollapsibleList {
  static render({
    items,
    renderItem,
    initialCount = 5,
    emptyMessage = 'No items to display',
    showMoreText = 'Show More',
    showLessText = 'Show Less'
  }) {
    if (!items?.length) {
      return `
        <div class="alert alert-info mb-0">
          ${emptyMessage}
        </div>
      `;
    }

    const hasMore = items.length > initialCount;
    const visibleItems = hasMore ? items.slice(0, initialCount) : items;

    return `
      <div class="collapsible-list">
        <div class="list-content">
          ${visibleItems.map(renderItem).join('')}
        </div>
        ${hasMore ? `
          <div class="collapsed-content d-none">
            ${items.slice(initialCount).map(renderItem).join('')}
          </div>
          <div class="text-center mt-3">
            <button class="btn btn-outline-secondary btn-sm toggle-list">
              <span class="more-text">
                ${IconService.createIcon('ChevronDown')}
                ${showMoreText} (${items.length - initialCount} more)
              </span>
              <span class="less-text d-none">
                ${IconService.createIcon('ChevronUp')}
                ${showLessText}
              </span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  static attachEventListeners(container) {
    const toggleBtn = container.querySelector('.toggle-list');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const list = toggleBtn.closest('.collapsible-list');
        const collapsedContent = list.querySelector('.collapsed-content');
        const moreText = toggleBtn.querySelector('.more-text');
        const lessText = toggleBtn.querySelector('.less-text');

        collapsedContent.classList.toggle('d-none');
        moreText.classList.toggle('d-none');
        lessText.classList.toggle('d-none');
      });
    }
  }
}