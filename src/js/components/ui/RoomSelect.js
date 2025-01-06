import { RoomService } from '../../services/RoomService.js';
import { IconService } from '../../services/IconService.js';

export class RoomSelect {
  constructor(containerId, propertyId) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    this.isChangeoverId = propertyId.includes('-'); // Check if it's a UUID
    this.roomService = new RoomService();
    this.rooms = [];
    this.initialize();
  }

  async initialize() {
    try {
      this.rooms = await this.roomService.getRooms(this.propertyId, this.isChangeoverId);
      console.debug('RoomSelect: Initialized with rooms', {
        count: this.rooms.length,
        rooms: this.rooms.map(r => r.name)
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
      datalist.innerHTML = this.rooms.map(room => `<option value="${room.name}">`).join('');
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
          <datalist id="roomSuggestions">
            ${this.rooms.map(room => `<option value="${room.name}">`).join('')}
          </datalist>
          <div class="invalid-feedback">
            Please specify where the item was found
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const input = this.container.querySelector('#location');
    
    const handleRoomChange = async (e) => {
      const value = e.target.value.trim();
      if (!value) return;

      console.debug('RoomSelect: Input blur event', { value });
      
      try {
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
            const datalist = this.container.querySelector('#roomSuggestions');
            datalist.innerHTML = this.rooms.map(r => `<option value="${r.name}">`).join('');
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
      }
    };

    // Remove any existing listeners
    input.removeEventListener('change', handleRoomChange);
    // Add new listener
    input.addEventListener('change', handleRoomChange);
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
}