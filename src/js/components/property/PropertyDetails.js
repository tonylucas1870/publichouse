import { IconService } from '../../services/IconService.js';
import { FindingsService } from '../../services/FindingsService.js';
import { FindingsList } from '../findings/FindingsList.js';
import { PropertyService } from '../../services/PropertyService.js';
import { RoomList } from './RoomList.js';
import { PropertyUtilities } from './PropertyUtilities.js';
import { PropertyHeader } from './PropertyHeader.js';
import { PropertyForm } from './PropertyForm.js';
import { PropertyAccess } from './PropertyAccess.js';
import { TaskList } from './TaskList.js';
import { PropertyTaskService } from '../../services/PropertyTaskService.js';
import { CalendarSync } from './CalendarSync.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { Navigation } from '../ui/Navigation.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js'; 
import { CollapsibleSection } from '../ui/CollapsibleSection.js';
import { ICalFeedInfo } from './ICalFeedInfo.js';

export class PropertyDetails {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.propertyService = new PropertyService();
    this.taskService = new PropertyTaskService();
    this.property = null;
    this.isEditing = false;
    
    if (!this.container) {
      throw new Error('Property details container not found');
    }
  }

  async initialize(propertyId) {
    try {
      if (!propertyId) {
        throw new Error('No property ID provided');
      }

      this.showLoading();
      console.debug('PropertyDetails: Initializing with ID', { propertyId });

      const result = await this.propertyService.getProperty(propertyId);
      if (!result) {
        throw new Error('Property not found');
      }

      const { data: property, isAdmin } = result;
      console.debug('PropertyDetails: Got property data', { 
        property,
        isAdmin,
        accessLevel: property?.property_access?.[0]?.access_level
      });

      this.property = property;
      if (!this.property) {
        throw new Error('Property not found');
      }
      this.property.isAdmin = isAdmin;

      console.debug('PropertyDetails: Rendering with access', {
        isAdmin: this.property.isAdmin,
        propertyId: this.property.id,
        accessLevel: this.property?.property_access?.[0]?.access_level
      });

      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading property details:', error);
      this.showError(error.message);
    }
  }

  showLoading() {
    this.container.innerHTML = LoadingSpinner.render();
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="mb-4">
        <div class="d-flex justify-content-between align-items-center">
          ${Navigation.renderBackButton()}
          <button class="btn btn-outline-secondary btn-sm" onclick="window.location.reload()">
            ${IconService.createIcon('RefreshCw')}
            Retry
          </button>
        </div>
        <div class="alert alert-danger mt-3 d-flex align-items-center gap-2">
          ${IconService.createIcon('AlertCircle')}
          <div>
            <strong>Error:</strong> ${message || 'Failed to load property details'}
            <div class="small text-danger mt-1">
              Please check that the property exists and you have permission to view it.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    this.container.innerHTML = `
      <div class="mb-4">
        ${Navigation.renderBackButton()}
      </div>

      <!-- Property Management Card -->
      <div class="card">
        <div class="card-body">
          ${this.isEditing && this.property.isAdmin ? 
            PropertyForm.render(this.property) :
            PropertyHeader.render(this.property)
          }
          ${!this.isEditing ? `
            <div class="mt-3" id="calendarSyncContainer" data-is-admin="${this.property.isAdmin}"></div>
            <div class="mt-3" id="icalFeedContainer"></div>
          ` : ''}
        </div>
      </div>
      
      <!-- Tasks -->
      ${CollapsibleSection.render({
        title: 'Standard Tasks',
        icon: 'ListChecks',
        headerClass: 'bg-primary bg-opacity-10',
        content: {
          headerContent: '',
          body: `<div id="tasksContainer" data-is-admin="${this.property.isAdmin || false}"></div>`
        },
        isCollapsed: CollapsibleSection.getStoredState('standard-tasks')
      })}
      
      <!-- Main Content -->
      <div class="row row-cols-1 row-cols-lg-2 g-4">
        <!-- Rooms -->
        <div class="col">
          ${CollapsibleSection.render({
            title: 'Rooms',
            icon: 'DoorClosed',
            headerClass: 'bg-primary bg-opacity-10',
            content: {
              headerContent: '',
              body: `<div id="roomListContainer" data-is-admin="${this.property.isAdmin || false}"></div>`
            },
            isCollapsed: CollapsibleSection.getStoredState('rooms')
          })}
        </div>

        <!-- Utilities -->
        <div class="col">
          ${CollapsibleSection.render({
            title: 'Utilities',
            icon: 'Zap',
            headerClass: 'bg-primary bg-opacity-10',
            content: {
              headerContent: '',
              body: `<div id="utilitiesContainer" data-is-admin="${this.property.isAdmin || false}"></div>`
            },
            isCollapsed: CollapsibleSection.getStoredState('utilities')
          })}
        </div>
      </div>
    `;

    // Initialize sub-components
    new RoomList('roomListContainer', this.property.id, this.property.isAdmin);
    new PropertyUtilities('utilitiesContainer', this.property.id, this.property.isAdmin);
    
    // Initialize collapsible sections
    CollapsibleSection.attachEventListeners(this.container);
    
    if (this.property.isAdmin) {
      const taskList = new TaskList('tasksContainer', this.property.id, this.taskService);
      taskList.initialize();
    }

    // Initialize calendar sync if not editing
    if (!this.isEditing && this.property.calendar_url) {
      new CalendarSync('calendarSyncContainer', this.property.id, this.property.calendar_url, this.property.isAdmin);
    }

    // Initialize iCal feed info
    if (!this.isEditing && this.property) {
      new ICalFeedInfo('icalFeedContainer', this.property.id);
    }
  }

  attachEventListeners() {
    const editBtn = this.container.querySelector('#editPropertyBtn');
    if (editBtn && this.property.isAdmin) {
      editBtn.addEventListener('click', () => {
        this.isEditing = true;
        this.render();
        this.attachFormListeners();
      });
    }
  }

  attachFormListeners() {
    const form = this.container.querySelector('#propertyForm');
    const cancelBtn = this.container.querySelector('#cancelEditBtn');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit(form);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.isEditing = false;
        this.render();
        this.attachEventListeners();
      });
    }
  }

  async handleSubmit(form) {
    try {
      const updatedProperty = await this.propertyService.updateProperty(
        this.property.id,
        {
          name: form.propertyName.value.trim(),
          address: form.propertyAddress.value.trim(),
          calendar_url: form.calendarUrl.value.trim() || null
        }
      );

      this.property = updatedProperty;
      this.property.isAdmin = true; // Preserve admin status
      this.isEditing = false;
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error updating property:', error);
      showErrorAlert(error.message);
    }
  }
}