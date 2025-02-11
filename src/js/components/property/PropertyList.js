import { IconService } from '../../services/IconService.js';
import { PropertyModal } from './PropertyModal.js';
import { EventEmitter } from '../../utils/EventEmitter.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';
import { ErrorDisplay } from '../ui/ErrorDisplay.js';
import { CollapsibleSection } from '../ui/CollapsibleSection.js';
import { CollapsibleList } from '../ui/CollapsibleList.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { supabase } from '../../lib/supabase.js';

export class PropertyList {
  constructor(containerId, propertyService) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error('Property list container not found');
    }
    
    this.propertyService = propertyService;
    if (!this.propertyService) {
      throw new Error('Property service is required');
    }
    
    this.properties = [];
    this.selectedPropertyIds = new Set();
    this.events = new EventEmitter();
    this.initialize();
  }

  async initialize() {
    try {
      this.showLoading();
      
      try {
        // Get demo property ID if it exists
        const { data: demoData } = await supabase.rpc('get_demo_property');
        this.demoPropertyId = demoData;
      } catch (error) {
        console.debug('Demo property not found:', error);
      }
      
      this.properties = await this.propertyService.getProperties();
      this.render();
    } catch (error) {
      console.error('Error loading properties:', error);
      this.showError(error.message);
    }
  }

  showLoading() {
    this.container.innerHTML = LoadingSpinner.render();
  }

  showError(message) {
    this.container.innerHTML = ErrorDisplay.render(message || 'Failed to load properties');
  }

  render() {
    const content = {
      headerContent: `
        ${!this.properties.length ? `
          <button class="btn btn-outline-primary btn-sm me-2" id="viewDemoBtn">
            ${IconService.createIcon('Eye')}
            View Demo
          </button>
        ` : ''}
        <button class="btn btn-primary btn-sm" id="addPropertyBtn">
          ${IconService.createIcon('Plus')}
          Add
        </button>
      `,
      body: this.renderPropertiesList()
    };

    this.container.innerHTML = CollapsibleSection.render({
      title: 'Properties',
      icon: 'Building',
      content,
      isCollapsed: CollapsibleSection.getStoredState('properties')
    });

    CollapsibleSection.attachEventListeners(this.container);
    CollapsibleList.attachEventListeners(this.container);
    this.attachEventListeners();
  }

  renderPropertiesList() {
    return CollapsibleList.render({
      items: this.properties,
      renderItem: (property) => this.renderPropertyItem(property),
      emptyMessage: 'No properties added yet.',
      showMoreText: 'Show More Properties'
    });
  }

  renderPropertyItem(property) {
    const isSelected = this.selectedPropertyIds.has(property.id);
    return `
      <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center property-item mb-2"
           data-property-id="${property.id}">
        <div class="d-flex align-items-center gap-3">
          <div class="form-check mb-0">
            <input class="form-check-input" type="checkbox" 
                   id="property-${property.id}"
                   ${isSelected ? 'checked' : ''}
                   style="cursor: pointer;">
          </div>
          <div>
            <h6 class="mb-1">${property.name}</h6>
            <small class="text-muted">${property.address}</small>
          </div>
        </div>
        <div>
          <a href="/?property=${property.id}" 
             class="btn btn-outline-secondary btn-sm manage-btn">
            ${IconService.createIcon('Settings')}
            Manage
          </a>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Add Property button
    const addPropertyBtn = this.container.querySelector('#addPropertyBtn');
    const viewDemoBtn = this.container.querySelector('#viewDemoBtn');
    
    if (addPropertyBtn) {
      addPropertyBtn.addEventListener('click', () => {
        PropertyModal.show(async (formData) => {
          try {
            await this.propertyService.createProperty(formData);
            await this.initialize();
          } catch (error) {
            showErrorAlert(error.message || 'Failed to create property');
          }
        });
      });
    }

    // View Demo button
    if (viewDemoBtn) {
      viewDemoBtn.addEventListener('click', async () => {
        try {
          viewDemoBtn.disabled = true;
          viewDemoBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Loading Demo...
          `;

          // Create demo property if it doesn't exist
          if (!this.demoPropertyId) {
            const { data } = await supabase.rpc('create_demo_property');
            this.demoPropertyId = data;
          }
          
          // Navigate to demo property
          if (this.demoPropertyId) {
            showErrorAlert('Loading demo property...', 'success');
            window.location.href = `/?property=${this.demoPropertyId}`;
          } else {
            throw new Error('Failed to create demo property');
          }
        } catch (error) {
          console.error('Demo error:', error);
          showErrorAlert('Failed to load demo. Please try again.');
        } finally {
          viewDemoBtn.disabled = false;
          viewDemoBtn.innerHTML = `
            ${IconService.createIcon('Eye')}
            View Demo
          `;
        }
      });
    }

    // Property item clicks (for filtering)
    this.container.querySelectorAll('.property-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't filter if clicking buttons or checkbox
        if (e.target.closest('.manage-btn') || 
            e.target.closest('.form-check-input')) {
          return;
        }
        const propertyId = item.dataset.propertyId;
        this.togglePropertySelection(propertyId);
      });
    });

    // Checkbox clicks
    this.container.querySelectorAll('.form-check-input').forEach(checkbox => {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const propertyId = e.target.closest('.property-item').dataset.propertyId;
        this.togglePropertySelection(propertyId);
      });
    });
  }

  togglePropertySelection(propertyId) {
    if (this.selectedPropertyIds.has(propertyId)) {
      this.selectedPropertyIds.delete(propertyId);
    } else {
      this.selectedPropertyIds.add(propertyId);
    }
    
    // Notify listeners with selected property IDs or null if none selected
    const selectedIds = Array.from(this.selectedPropertyIds);
    this.events.emit('propertySelected', selectedIds.length > 0 ? selectedIds : null);
    
    this.render();
  }

  onPropertySelected(callback) {
    this.events.on('propertySelected', callback);
    return () => this.events.off('propertySelected', callback);
  }
}