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
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading rooms:', error);
      this.showError();
    }
  }

  render() {
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
    
    input.addEventListener('change', async (e) => {
      const value = e.target.value.trim();
      if (value && !this.rooms.find(room => room.name === value)) {
        try {
          const newRoom = await this.roomService.addRoom(this.propertyId, value);
          if (newRoom) {
            this.rooms.push(newRoom);
            this.rooms.sort((a, b) => a.name.localeCompare(b.name));
            this.render();
            this.attachEventListeners();
            
            // Restore the input value after re-render
            this.container.querySelector('#location').value = value;
          }
        } catch (error) {
          console.error('Error adding room:', error);
        }
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
    return this.container.querySelector('#location').value.trim();
  }
}