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
      headerContent: '<div id="dateFilterContainer"></div>',
      body: this.renderChangeoversList()
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Scheduled Changeovers',
      icon: 'Calendar',
      content,
      isCollapsed: CollapsibleSection.getStoredState('changeovers')
    });

    // Initialize date filter if we have changeovers
    if (this.changeovers.length > 0) {
      this.dateFilter = new DateFilter('dateFilterContainer', (filter) => {
        this.applyDateFilter(filter);
      });
    }

    CollapsibleSection.attachEventListeners(this.container);
    this.attachEventListeners();
  }

  // ... rest of the class implementation ...
}