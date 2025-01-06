import { IconService } from '../../services/IconService.js';
import { RoomDetailsService } from '../../services/RoomDetailsService.js';
import { ContentsForm } from './ContentsForm.js';
import { WallForm } from './WallForm.js';
import { LightingForm } from './LightingForm.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { LoadingSpinner } from '../ui/LoadingSpinner.js';

export class RoomDetails {
  constructor(containerId, roomId, roomName, isAdmin = false) {
    this.container = document.getElementById(containerId);
    this.roomId = roomId;
    this.roomName = roomName;
    this.isAdmin = isAdmin;
    this.roomDetailsService = new RoomDetailsService();
    this.details = null;
    this.isEditing = false;
    this.isSaving = false;

    if (!this.container) {
      throw new Error('Room details container not found');
    }

    this.init();
  }

  async init() {
    try {
      this.showLoading();
      await this.loadDetails();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error initializing room details:', error);
      this.showError(error.message);
    }
  }

  showLoading() {
    this.container.innerHTML = LoadingSpinner.render();
  }

  async loadDetails() {
    try {
      this.details = await this.roomDetailsService.getRoomDetails(this.roomId);
      // Initialize arrays if they don't exist
      this.details.contents = this.details.contents || [];
      this.details.walls = this.details.walls || [];
      this.details.lighting = this.details.lighting || [];
    } catch (error) {
      throw new Error('Failed to load room details');
    }
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        ${message || 'Failed to load room details. Please try again later.'}
      </div>
    `;
  }

  render() {
    this.container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h6 class="mb-0">${this.roomName}</h6>
        ${this.isAdmin ? `
        <button type="button" 
                class="btn btn-outline-primary btn-sm" 
                id="editDetailsBtn"
                ${this.isSaving ? 'disabled' : ''}>
          ${IconService.createIcon(this.isEditing ? 'Save' : 'Edit')}
          ${this.isEditing ? 'Save Changes' : 'Edit Details'}
          ${this.isSaving ? '<span class="spinner-border spinner-border-sm ms-1"></span>' : ''}
        </button>
        ` : ''}
      </div>

      <div class="row g-4">
        <!-- Contents Section -->
        <div class="col-12">
          <div class="card">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('Package')}
              <h6 class="mb-0">Contents</h6>
            </div>
            <div class="card-body">
              ${this.renderContentsSection()}
            </div>
          </div>
        </div>

        <!-- Walls Section -->
        <div class="col-md-6">
          <div class="card">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('PaintBucket')}
              <h6 class="mb-0">Walls</h6>
            </div>
            <div class="card-body">
              ${this.renderWallsSection()}
            </div>
          </div>
        </div>

        <!-- Lighting Section -->
        <div class="col-md-6">
          <div class="card">
            <div class="card-header bg-transparent d-flex align-items-center gap-2">
              ${IconService.createIcon('Lightbulb')}
              <h6 class="mb-0">Lighting</h6>
            </div>
            <div class="card-body">
              ${this.renderLightingSection()}
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize icons
    IconService.initialize();

    // Attach event listeners
    this.attachEventListeners();

    // Attach editing event listeners if in edit mode
    if (this.isEditing) {
      this.attachEditingEventListeners();
    }

    // Attach click handlers for contents items in view mode
    if (!this.isEditing) {
      this.container.querySelectorAll('.contents-item').forEach(item => {
        item.addEventListener('click', () => {
          const itemData = JSON.parse(item.dataset.item);
          import('./ContentsModal.js').then(({ ContentsModal }) => {
            ContentsModal.show(itemData);
          });
        });
      });
    }
  }

  renderContentsSection() {
    if (this.isEditing) {
      return `
        <div class="contents-list">
          ${this.details.contents.map((item, index) => `
            <div class="contents-item" data-index="${index}">
              ${ContentsForm.render(item)}
            </div>
          `).join('')}
          <button type="button" class="btn btn-outline-primary btn-sm mt-2" id="addContentsBtn">
            ${IconService.createIcon('Plus')}
            Add Item
          </button>
        </div>
      `;
    }

    return this.details.contents.length ? `
      <div class="row row-cols-1 row-cols-md-2 g-4">
        ${this.details.contents.map(item => `
          <div class="col contents-item" data-item='${JSON.stringify(item)}'>
            <div class="card h-100">
              ${item.images?.[0] ? `
                <img src="${item.images[0]}" 
                     class="card-img-top" 
                     alt="${item.name}"
                     style="height: 200px; object-fit: cover">
                ${item.images.length > 1 ? `
                  <div class="position-absolute top-0 end-0 m-2">
                    <span class="badge bg-dark bg-opacity-75">
                      +${item.images.length - 1} more
                    </span>
                  </div>
                ` : ''}
              ` : ''}
              <div class="card-body">
                <h6 class="card-title">${item.name}</h6>
                ${item.description ? `
                  <p class="card-text small text-muted">${item.description}</p>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-muted mb-0">No items added yet.</p>';
  }

  renderWallsSection() {
    if (this.isEditing) {
      return `
        <div class="walls-list">
          ${this.details.walls.map(wall => `
            <div class="wall-item" data-id="${wall.id}">
              ${WallForm.render(wall)}
            </div>
          `).join('')}
          <button type="button" class="btn btn-outline-primary btn-sm mt-2" id="addWallBtn">
            ${IconService.createIcon('Plus')}
            Add Wall
          </button>
        </div>
      `;
    }

    return this.details.walls.length ? `
      <div class="list-group list-group-flush">
        ${this.details.walls.map(wall => `
          <div class="list-group-item px-0">
            <h6 class="mb-1">${wall.location}</h6>
            <p class="mb-1"><strong>Color:</strong> ${wall.color}</p>
            ${wall.notes ? `<p class="mb-0 text-muted small">${wall.notes}</p>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-muted mb-0">No wall details added yet.</p>';
  }

  renderLightingSection() {
    if (this.isEditing) {
      return `
        <div class="lighting-list">
          ${this.details.lighting.map(light => `
            <div class="lighting-item" data-id="${light.id}">
              ${LightingForm.render(light)}
            </div>
          `).join('')}
          <button type="button" class="btn btn-outline-primary btn-sm mt-2" id="addLightingBtn">
            ${IconService.createIcon('Plus')}
            Add Lighting Fixture
          </button>
        </div>
      `;
    }

    return this.details.lighting.length ? `
      <div class="list-group list-group-flush">
        ${this.details.lighting.map(light => `
          <div class="list-group-item px-0">
            <h6 class="mb-1">${light.location}</h6>
            <p class="mb-1"><strong>Fixture:</strong> ${light.fixture}</p>
            ${light.notes ? `<p class="mb-0 text-muted small">${light.notes}</p>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-muted mb-0">No lighting fixtures added yet.</p>';
  }

  attachEventListeners() {
    const editBtn = this.container.querySelector('#editDetailsBtn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling to modal backdrop
        this.handleEditClick();
      });
    }
  }

  attachEditingEventListeners() {
    // Contents items
    const addContentsBtn = this.container.querySelector('#addContentsBtn');
    if (addContentsBtn) {
      addContentsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleAddContents();
      });
    }

    this.container.querySelectorAll('.contents-item').forEach(item => {
      const index = parseInt(item.dataset.index);
      ContentsForm.attachEventListeners(
        item,
        (data) => this.handleContentsUpdate(index, data),
        () => this.handleContentsRemove(index)
      );
    });

    // Wall items
    const addWallBtn = this.container.querySelector('#addWallBtn');
    if (addWallBtn) {
      addWallBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleAddWall();
      });
    }

    this.container.querySelectorAll('.wall-item').forEach(item => {
      const id = item.dataset.id;
      WallForm.attachEventListeners(
        item,
        (data) => this.handleWallUpdate(id, data),
        () => this.handleWallRemove(id)
      );
    });

    // Lighting items
    const addLightingBtn = this.container.querySelector('#addLightingBtn');
    if (addLightingBtn) {
      addLightingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleAddLighting();
      });
    }

    this.container.querySelectorAll('.lighting-item').forEach(item => {
      const id = item.dataset.id;
      LightingForm.attachEventListeners(
        item,
        (data) => this.handleLightingUpdate(id, data),
        () => this.handleLightingRemove(id)
      );
    });
  }

  handleAddContents() {
    this.details.contents.push({
      name: '',
      description: '',
      image_url: null
    });
    this.render();
  }

  handleContentsUpdate(index, data) {
    this.details.contents[index] = data;
  }

  handleContentsRemove(index) {
    this.details.contents.splice(index, 1);
    this.render();
  }

  handleAddWall() {
    this.details.walls.push({
      id: crypto.randomUUID(),
      location: '',
      color: '',
      notes: ''
    });
    this.render();
  }

  handleWallUpdate(id, data) {
    const index = this.details.walls.findIndex(w => w.id === id);
    if (index !== -1) {
      this.details.walls[index] = { ...data, id };
    }
  }

  handleWallRemove(id) {
    this.details.walls = this.details.walls.filter(w => w.id !== id);
    this.render();
  }

  handleAddLighting() {
    this.details.lighting.push({
      id: crypto.randomUUID(),
      location: '',
      fixture: '',
      notes: ''
    });
    this.render();
  }

  handleLightingUpdate(id, data) {
    const index = this.details.lighting.findIndex(l => l.id === id);
    if (index !== -1) {
      this.details.lighting[index] = { ...data, id };
    }
  }

  handleLightingRemove(id) {
    this.details.lighting = this.details.lighting.filter(l => l.id !== id);
    this.render();
  }

  async handleEditClick() {
    if (this.isSaving) return;

    if (this.isEditing) {
      try {
        this.isSaving = true;
        this.render();

        await this.roomDetailsService.updateRoomDetails(this.roomId, {
          contents: this.details.contents,
          walls: this.details.walls,
          lighting: this.details.lighting
        });

        this.isEditing = false;
        showErrorAlert('Room details saved successfully', 'success');
      } catch (error) {
        console.error('Error saving room details:', error);
        showErrorAlert(error.message);
      } finally {
        this.isSaving = false;
        this.render();
      }
    } else {
      this.isEditing = true;
      this.render();
    }
  }
}