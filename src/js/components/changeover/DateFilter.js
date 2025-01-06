import { IconService } from '../../services/IconService.js';
import { formatDateInput } from '../../utils/dateUtils.js';

export class DateFilter {
  constructor(containerId, onFilterChange) {
    this.container = document.getElementById(containerId);
    this.onFilterChange = onFilterChange;
    this.isOpen = false;
    this.currentFilter = {
      startDate: null,
      endDate: null
    };
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="dropdown mb-3">
        <button class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" 
                type="button" 
                id="dateFilterBtn">
          ${IconService.createIcon('Calendar')}
          ${this.getFilterButtonText()}
        </button>
        <div class="dropdown-menu p-3" style="min-width: 300px; display: none;">
          <div class="mb-3">
            <label for="startDate" class="form-label small">From</label>
            <input type="date" class="form-control form-control-sm" id="startDate" 
                   value="${this.currentFilter.startDate || ''}">
          </div>
          <div class="mb-3">
            <label for="endDate" class="form-label small">To</label>
            <input type="date" class="form-control form-control-sm" id="endDate"
                   value="${this.currentFilter.endDate || ''}">
          </div>
          <div class="d-flex justify-content-between">
            <button class="btn btn-sm btn-outline-secondary" id="clearFilterBtn">
              Clear
            </button>
            <button class="btn btn-sm btn-primary" id="applyFilterBtn">
              Apply
            </button>
          </div>
        </div>
      </div>
    `;
  }

  getFilterButtonText() {
    if (!this.currentFilter.startDate && !this.currentFilter.endDate) {
      return 'Filter by Date';
    }
    
    if (this.currentFilter.startDate && this.currentFilter.endDate) {
      return `${formatDateInput(this.currentFilter.startDate)} - ${formatDateInput(this.currentFilter.endDate)}`;
    }
    
    if (this.currentFilter.startDate) {
      return `From ${formatDateInput(this.currentFilter.startDate)}`;
    }
    
    return `Until ${formatDateInput(this.currentFilter.endDate)}`;
  }

  attachEventListeners() {
    const filterBtn = this.container.querySelector('#dateFilterBtn');
    const dropdown = this.container.querySelector('.dropdown-menu');
    const startDate = this.container.querySelector('#startDate');
    const endDate = this.container.querySelector('#endDate');
    const clearBtn = this.container.querySelector('#clearFilterBtn');
    const applyBtn = this.container.querySelector('#applyFilterBtn');

    // Toggle dropdown
    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOpen = !this.isOpen;
      dropdown.style.display = this.isOpen ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.isOpen = false;
        dropdown.style.display = 'none';
      }
    });

    // Prevent dropdown from closing when clicking inside
    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Apply filter
    applyBtn.addEventListener('click', () => {
      this.currentFilter = {
        startDate: startDate.value || null,
        endDate: endDate.value || null
      };
      
      this.onFilterChange(this.currentFilter);
      this.render();
      this.attachEventListeners();
    });

    // Clear filter
    clearBtn.addEventListener('click', () => {
      this.currentFilter = {
        startDate: null,
        endDate: null
      };
      
      this.onFilterChange(this.currentFilter);
      this.render();
      this.attachEventListeners();
    });
  }
}