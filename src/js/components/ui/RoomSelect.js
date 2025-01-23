import { RoomService } from '../../services/RoomService.js';
import { IconService } from '../../services/IconService.js';

export class RoomSelect {
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

  attachEventListeners() {
    const input = this.container.querySelector('#location');
    
    // Track if we're currently processing a room change
    let isProcessing = false;
    
    const handleRoomChange = async (e) => {
      // Prevent concurrent processing
      if (isProcessing) return;
      
      const value = e.target.value.trim();
      if (!value) return;

      console.debug('RoomSelect: Processing room change', { 
        value,
        eventType: e.type
      });
      
      try {
        isProcessing = true;
        let room;
        const existingRoom = this.rooms.find(room => 
          room.name.toLowerCase() === value.toLowerCase()
        );
        
        if (existingRoom) {
          console.debug('RoomSelect: Using existing room', existingRoom);
          room = existingRoom;
        } else {
          console.debug('RoomSelect: Creating new room', { value });
          room = await this.roomService.addRoom(this.propertyId, value);
          if (room) {
            console.debug('RoomSelect: Room created successfully', room);
            this.rooms.push(room);
            this.rooms.sort((a, b) => a.name.localeCompare(b.name));
            // Just update datalist
            this.updateDatalist();
          }
        }

        // Normalize case
        input.value = room.name;

        // Emit room change event
        const event = new CustomEvent('roomchange', { 
          detail: { room } 
        });
        this.container.dispatchEvent(event);

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