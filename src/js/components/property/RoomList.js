import { IconService } from '../../services/IconService.js';
import { RoomService } from '../../services/RoomService.js';
import { RoomModal } from '../room/RoomModal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class RoomList {
  constructor(containerId, propertyId) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    this.roomService = new RoomService();
    this.rooms = [];
    this.initialize();
  }

  async initialize() {
    try {
      this.rooms = await this.roomService.getRooms(this.propertyId);
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading rooms:', error);
      this.render(error.message);
    }
  }

  render(errorMessage = null) {
    if (errorMessage) {
      this.container.innerHTML = `
        <div class="alert alert-danger">${errorMessage}</div>
      `;
      return;
    }

    const isAdmin = this.container.dataset.isAdmin === 'true';
    this.container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="h5 mb-0">Rooms</h4>
        ${isAdmin ? `
        <button class="btn btn-outline-primary btn-sm" id="addRoomBtn">
          ${IconService.createIcon('Plus')} Add Room
        </button>
        ` : ''}
      </div>

      ${this.rooms.length === 0 ? `
        <div class="alert alert-info">No rooms added yet.</div>
      ` : `
        <div class="list-group">
          ${this.rooms.map(room => this.renderRoom(room)).join('')}
        </div>
      `}

      <!-- Add Room Modal -->
      <div class="modal" id="addRoomModal" tabindex="-1" style="display: none;">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Add New Room</h5>
              <button type="button" class="btn-close" data-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="addRoomForm">
                <div class="mb-3">
                  <label for="roomName" class="form-label">Room Name</label>
                  <input type="text" class="form-control" id="roomName" required>
                </div>
                <div class="d-flex justify-content-end gap-2">
                  <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                  <button type="submit" class="btn btn-primary">Add Room</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize icons after rendering
    IconService.initialize();
  }

  renderRoom(room) {
    const isAdmin = this.container.dataset.isAdmin === 'true';
    return `
      <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center room-item"
           data-room-id="${room.id}"
           data-room-name="${room.name}"
           style="cursor: ${isAdmin ? 'pointer' : 'default'}">
        <span>${room.name}</span>
        ${isAdmin ? `
        <button class="btn btn-outline-danger btn-sm delete-room" 
                data-room-id="${room.id}"
                data-room-name="${room.name}">
          ${IconService.createIcon('Trash2')}
        </button>
        ` : ''}
      </div>
    `;
  }

  attachEventListeners() {
    // Add Room button
    const addRoomBtn = this.container.querySelector('#addRoomBtn');
    if (addRoomBtn) {
      addRoomBtn.addEventListener('click', () => this.showAddRoomModal());
    }

    // Room click events
    this.container.querySelectorAll('.room-item').forEach(roomElement => {
      roomElement.addEventListener('click', (e) => {
        // Don't open modal if clicking delete button
        if (e.target.closest('.delete-room')) return;
        
        const { roomId, roomName } = e.currentTarget.dataset;
        const isAdmin = this.container.dataset.isAdmin === 'true';
        RoomModal.show(roomId, roomName, isAdmin);
      });
    });

    // Delete Room buttons
    this.container.querySelectorAll('.delete-room').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const roomId = e.currentTarget.dataset.roomId;
        const roomName = e.currentTarget.dataset.roomName;
        await this.handleDeleteRoom(roomId, roomName);
      });
    });

    // Modal form submission
    const form = this.container.querySelector('#addRoomForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddRoom(e));
    }

    // Modal close buttons
    this.container.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
      btn.addEventListener('click', () => this.hideAddRoomModal());
    });
  }

  showAddRoomModal() {
    const modal = this.container.querySelector('#addRoomModal');
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
  }

  hideAddRoomModal() {
    const modal = this.container.querySelector('#addRoomModal');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    // Reset form
    modal.querySelector('form').reset();
  }

  async handleAddRoom(e) {
    e.preventDefault();
    const form = e.target;
    const roomName = form.roomName.value.trim();

    try {
      const newRoom = await this.roomService.addRoom(this.propertyId, roomName);
      if (newRoom) {
        this.rooms.push(newRoom);
        this.rooms.sort((a, b) => a.name.localeCompare(b.name));
      }
      this.hideAddRoomModal();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error adding room:', error);
      showErrorAlert(error.message);
    }
  }

  async handleDeleteRoom(roomId, roomName) {
    if (!confirm(`Are you sure you want to delete "${roomName}"?`)) {
      return;
    }

    try {
      await this.roomService.deleteRoom(this.propertyId, roomId);
      this.rooms = this.rooms.filter(room => room.id !== roomId);
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error deleting room:', error);
      showErrorAlert(error.message);
    }
  }
}