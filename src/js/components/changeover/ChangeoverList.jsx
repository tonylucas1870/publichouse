import { IconService } from '../../services/IconService.js';
import { formatDate } from '../../utils/dateUtils.js';
import { DateFilter } from './DateFilter.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { CollapsibleSection } from '../ui/CollapsibleSection.js';

export class ChangeoverList {
  // ... existing constructor and other methods ...

  render() {
    const content = {
      headerContent: `
        <div class="d-flex justify-content-between align-items-center">
          <div id="dateFilterContainer"></div>
          <div>
            <button class="btn btn-primary btn-sm" id="scheduleChangeoverBtn">
              ${IconService.createIcon('Plus')}
              Schedule Changeover
            </button>
          </div>
        </div>
      `,
      body: this.renderChangeoversList()
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Scheduled Changeovers',
      icon: 'Calendar',
      content,
      isCollapsed: CollapsibleSection.getStoredState('changeovers')
    });

    CollapsibleSection.attachEventListeners(this.container);
    this.attachEventListeners();
    
    // Always initialize date filter
    this.dateFilter = new DateFilter('dateFilterContainer', (filter) => {
      this.applyDateFilter(filter);
    });
    
    this.attachShareEventListeners();
  }

  // ... rest of the class implementation ...
}