import { RoomService } from '../../services/RoomService.js';
import { IconService } from '../../services/IconService.js';
import { Modal } from './Modal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class RoomSelect {
  constructor(containerId, propertyId) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    this.pendingRoomName = null;
    this.roomService = new RoomService();
    this.rooms = [];
    this.initialize();
  }

  async initialize() {
    try {
      this.rooms = await this.roomService.getRooms(this.propertyId);
      console.debug('RoomSelect: Got rooms from service', {
        count: this.rooms.length,
        rooms: this.rooms.map(r => ({ id: r.id, name: r.name }))
      });
      this.isSharedAccess = this.roomService.isSharedAccess;
      this.render();
      this.attachEventListeners();
      
      // If we have a pending room name, set it after initialization
      if (this.pendingRoomName) {
        console.debug('RoomSelect: Setting pending room name', { name: this.pendingRoomName });
        this.setValue(this.pendingRoomName);
        this.pendingRoomName = null;
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      this.showError();
    }
  }

  reset() {
    const input = this.container.querySelector('#location');
    if (input) {
      input.value = '';
      // Clear any pending room changes
      this.container.dispatchEvent(new CustomEvent('roomchange', { 
        detail: { room: null } 
      }));
    }
  }

  render() {
    const currentValue = this.container.querySelector('#location')?.value;

    this.container.innerHTML = `
      <div class="mb-3">
        <div class="position-relative">
          <input
            type="text"
            id="location"
            class="form-control"
            list="roomSuggestions"
            placeholder="Select or type a room name..."
            required
            autocomplete="off"
            spellcheck="false"
            value="${currentValue || ''}"
          />
          <datalist id="roomSuggestions"></datalist>
          <div class="invalid-feedback">
            Please specify where the item was found
          </div>
        </div>
      </div>
    `;
    
    // Update datalist
    this.updateDatalist();
  }

  showConfirmationModal(roomName) {
    const { modal, closeModal } = Modal.show({
      title: 'Add New Room',
      content: `
        <div class="mb-4">
          <p>Would you like to create a new room called "${roomName}"?</p>
          <p class="text-muted small">
            Please verify this is not a misspelling of an existing room name.
          </p>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="confirmAddRoom">
            ${IconService.createIcon('Plus')}
            Add Room
          </button>
        </div>
      `
    });

    // Handle confirmation
    const confirmBtn = modal.querySelector('#confirmAddRoom');
    confirmBtn.addEventListener('click', async () => {
      try {
        const room = await this.roomService.addRoom(this.propertyId, roomName);
        if (room) {
          this.rooms.push(room);
          this.rooms.sort((a, b) => a.name.localeCompare(b.name));
          this.updateDatalist();
          
          // Set input value and trigger room change
          const input = this.container.querySelector('#location');
          input.value = room.name;
          
          // Emit room change event
          const event = new CustomEvent('roomchange', { 
            detail: { room } 
          });
          this.container.dispatchEvent(event);
        }
        closeModal();
      } catch (error) {
        console.error('RoomSelect: Error creating room', error);
        showErrorAlert(error.message || 'Failed to create room');
      }
    });

    // Handle cancel
    modal.querySelector('[data-dismiss="modal"]').addEventListener('click', () => {
      closeModal();
      // Clear the input
      this.reset();
    });
  }

  attachEventListeners() {
    const input = this.container.querySelector('#location');
    
    // Track if we're currently processing a room change
    let isProcessing = false;
    
    const handleRoomChange = async (e) => {
      // Prevent concurrent processing
      if (isProcessing) return;
      
      const value = e.target.value.trim();
      if (!value) return;

      try {
        isProcessing = true;
        
        const existingRoom = this.rooms.find(room => 
          room.name.toLowerCase() === value.toLowerCase()
        );
        
        if (existingRoom) {
          // Use existing room
          input.value = existingRoom.name;
          const event = new CustomEvent('roomchange', { 
            detail: { room: existingRoom } 
          });
          this.container.dispatchEvent(event);
        } else {
          // Show confirmation modal for new room
          this.showConfirmationModal(value);
        }
      } catch (error) {
        console.error('RoomSelect: Error handling room:', error);
        input.value = ''; // Clear invalid input
        input.focus();
        throw error;
      } finally {
        isProcessing = false;
      }
    };

    // Handle datalist selection and input events
    const events = ['blur', 'change'];
    events.forEach(eventType => {
      input.addEventListener(eventType, handleRoomChange);
    });

    input.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      const existingRoom = this.rooms.find(room => 
        room.name.toLowerCase() === value.toLowerCase()
      );
      
      if (existingRoom) {
        input.value = existingRoom.name;
        const event = new CustomEvent('roomchange', { 
          detail: { room: existingRoom } 
        });
        this.container.dispatchEvent(event);
      }
    });
  }

  showError() {
    this.container.innerHTML = `
      <div class="mb-3">
        <label for="location" class="form-label d-flex align-items-center gap-2">
          ${IconService.createIcon('MapPin')}
          Location Found
        </label>
        <input
          type="text"
          id="location"
          class="form-control"
          placeholder="Enter room name..."
          required
          autocomplete="off"
          spellcheck="false"
        />
        <div class="invalid-feedback">
          Please specify where the item was found
        </div>
      </div>
    `;
  }

  getValue() {
    return this.container.querySelector('#location')?.value.trim() || '';
  }

  setValue(value) {
    console.debug('RoomSelect: setValue called', {
      value,
      hasRooms: this.rooms.length > 0,
      roomNames: this.rooms.map(r => r.name)
    });

    const input = this.container.querySelector('#location');
    if (!value) return;

    // If rooms aren't loaded yet, store the value to set later
    if (!this.rooms.length) {
      console.debug('RoomSelect: Storing pending room name', { value });
      this.pendingRoomName = value;
      console.warn('RoomSelect: Input element not found');
      return;
    }

    console.debug('RoomSelect: Setting value', { value });

    if (input && value) {
      // Find matching room
      const room = this.rooms.find(r => r.name.toLowerCase() === value.toLowerCase());
      
      console.debug('RoomSelect: Found matching room', { 
        value,
        room: room ? { id: room.id, name: room.name } : null
      });

      // Set value and trigger change
      input.value = value;
      
      // Emit room change event if room found
      if (room) {
        console.debug('RoomSelect: Emitting room change event', { room: { id: room.id, name: room.name } });
        this.container.dispatchEvent(new CustomEvent('roomchange', { 
          detail: { room } 
        }));
      }
    }
  }
  
  async getRooms() {
    return this.rooms;
  }

  updateDatalist() {
    const datalist = this.container.querySelector('#roomSuggestions');
    if (datalist) {
      datalist.innerHTML = this.rooms.map(room => `<option value="${room.name}">`).join('');
    }
    return this.rooms.map(room => `<option value="${room.name}">`).join('');
  }
}