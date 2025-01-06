import { RoomDetailsService } from '../../services/RoomDetailsService.js';

export class ContentsSelect {
  constructor(containerId, roomId) {
    this.container = document.getElementById(containerId);
    this.roomId = roomId;
    this.roomDetailsService = new RoomDetailsService();
    this.contents = [];
    this.initialize();
  }

  async initialize() {
    try {
      const details = await this.roomDetailsService.getRoomDetails(this.roomId);
      console.debug('ContentsSelect: Got room details', {
        roomId: this.roomId,
        contentsCount: details.contents?.length
      });
      this.contents = details.contents || [];
      this.render();
    } catch (error) {
      console.error('Error loading room contents:', error);
      this.showError();
    }
  }

  render() {
    if (!this.contents.length) {
      this.container.innerHTML = `
        <div class="mb-3">
          <label for="contentItem" class="form-label">Item</label>
          <input
            type="text"
            id="contentItem"
            class="form-control"
            placeholder="No items available for this room"
            disabled
          />
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="mb-3">
        <label for="contentItem" class="form-label">Item</label>
        <select id="contentItem" class="form-select">
          <option value="">Select an item...</option>
          ${this.contents.map((item, index) => `
            <option value="${index}">${item.name}</option>
          `).join('')}
        </select>
      </div>
    `;
  }

  showError() {
    this.container.innerHTML = `
      <div class="mb-3">
        <label for="contentItem" class="form-label">Item</label>
        <input
          type="text"
          id="contentItem"
          class="form-control"
          placeholder="Failed to load items"
          disabled
        />
      </div>
    `;
  }

  getValue() {
    const select = this.container.querySelector('#contentItem');
    if (!select?.value) {
      console.debug('ContentsSelect: No item selected');
      return null;
    }
    
    console.debug('ContentsSelect: Getting selected item', {
      value: select.value,
      contents: this.contents
    });
    const index = parseInt(select.value);
    const selectedItem = this.contents[index];
    
    console.debug('ContentsSelect: Selected item', {
      index,
      selectedItem,
      allContents: this.contents
    });
    
    return selectedItem;
  }
}