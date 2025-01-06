import { IconService } from '../../services/IconService.js';
import { PropertyService } from '../../services/PropertyService.js';
import { RoomList } from './RoomList.js';
import { PropertyUtilities } from './PropertyUtilities.js';
import { PropertyHeader } from './PropertyHeader.js';
import { PropertyForm } from './PropertyForm.js';
import { PropertyAccess } from './PropertyAccess.js';
import { CalendarSync } from './CalendarSync.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { Navigation } from '../ui/Navigation.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';

export class PropertyDetails {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.propertyService = new PropertyService();
    this.property = null;
    this.isEditing = false;
    
    if (!this.container) {
      throw new Error('Property details container not found');
    }
  }

  async initialize(propertyId) {
    try {
      if (!propertyId) {
        throw new Error('Property ID is required');
      }

      this.showLoading();
      console.debug('PropertyDetails: Initializing with ID', { propertyId });

      const result = await this.propertyService.getProperty(propertyId);
      const { data: property, isAdmin } = result;
      console.debug('PropertyDetails: Got property data', { 
        property,
        isAdmin,
        accessLevel: property?.property_access?.[0]?.access_level
      });

      this.property = property;
      this.property.isAdmin = isAdmin;
      
      if (!this.property) {
        throw new Error('Property not found');
      }

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
        ${Navigation.renderBackButton()}
        <div class="alert alert-danger mt-3">
          ${message || 'Failed to load property details. Please try again later.'}
        </div>
      </div>
    `;
  }

  render() {
    this.container.innerHTML = `
      <div class="mb-4">
        ${Navigation.renderBackButton()}
      </div>

      <!-- Property Details Card -->
      <div class="card mb-4">
        <div class="card-body">
          ${this.isEditing && this.property.isAdmin ? 
            PropertyForm.render(this.property) :
            PropertyHeader.render(this.property)
          }
          ${!this.isEditing ? `
            <div class="mt-3" id="calendarSyncContainer" data-is-admin="${this.property.isAdmin}"></div>
          ` : ''}
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="row g-4">
        <!-- Rooms -->
        <div class="col-12 col-lg-8">
          <div class="card h-100">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('DoorClosed')}
              <h3 class="h5 mb-0">Rooms</h3>
            </div>
            <div class="card-body">
              <div id="roomListContainer" data-is-admin="${this.property.isAdmin || false}"></div>
            </div>
          </div>
        </div>

        <!-- Utilities -->
        <div class="col-12 col-lg-4">
          <div class="card h-100">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('Zap')}
              <h3 class="h5 mb-0">Utilities</h3>
            </div>
            <div class="card-body">
              <div id="utilitiesContainer" data-is-admin="${this.property.isAdmin || false}"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize sub-components
    new RoomList('roomListContainer', this.property.id, this.property.isAdmin);
    new PropertyUtilities('utilitiesContainer', this.property.id, this.property.isAdmin);

    // Initialize calendar sync if not editing
    if (!this.isEditing && this.property.calendar_url) {
      new CalendarSync('calendarSyncContainer', this.property.id, this.property.calendar_url, this.property.isAdmin);
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
      this.isEditing = false;
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error updating property:', error);
      showErrorAlert(error.message);
    }
  }
}