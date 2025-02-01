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
      this.isSharedAccess = this.roomService.isSharedAccess;
      console.debug('RoomSelect: Initialized with rooms', {
        count: this.rooms.length,
        rooms: this.rooms.map(r => r.name),
        isSharedAccess: this.isSharedAccess
      });
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading rooms:', error);
      this.showError();
    }
  }

  render() {
    if (this.container.querySelector('#location')) {
      // If input exists, just update datalist
      const datalist = this.container.querySelector('#roomSuggestions');
      if (datalist) {
        datalist.innerHTML = this.rooms.map(room => `<option value="${room.name}">`).join('');
      }
      return;
    }

    this.container.innerHTML = `
      <div class="mb-3">
        <label for="location" class="form-label d-flex align-items-center gap-2">
          ${IconService.createIcon('MapPin')}
          Location Found
        </label>
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
      const input = this.container.querySelector('#location');
      input.value = '';
      input.focus();
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
        throw error; // Let the form handle the error
      } finally {
        isProcessing = false;
      }
    };

    // Handle datalist selection
    const handleInput = (e) => {
      if (e.inputType === 'insertReplacementText') {
        handleRoomChange(e);
      }
    };
    
    // Clean up old listeners
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Add listeners to fresh input
    newInput.addEventListener('blur', handleRoomChange);
    newInput.addEventListener('input', handleInput);
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
    return this.container.querySelector('#location').value.trim();
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