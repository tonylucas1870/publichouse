import { RoomDetailsService } from '../../services/RoomDetailsService.js';
import { IconService } from '../../services/IconService.js';
import { Modal } from './Modal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

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
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading room contents:', error);
      this.showError();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="mb-3">
        <label for="contentItem" class="form-label d-flex align-items-center gap-2">
          ${IconService.createIcon('Package')}
          Item
        </label>
        <div class="position-relative">
          <input
            type="text"
            id="contentItem"
            class="form-control"
            list="contentSuggestions"
            placeholder="Select or type an item name..."
            required
            autocomplete="off"
            spellcheck="false"
          />
          <datalist id="contentSuggestions">
            ${this.contents.map(item => `<option value="${item.name}">`).join('')}
          </datalist>
          <div class="invalid-feedback">
            Please specify the item
          </div>
        </div>
      </div>
    `;
  }

  showConfirmationModal(itemName) {
    const { modal, closeModal } = Modal.show({
      title: 'Add New Item',
      content: `
        <div class="mb-4">
          <p>Would you like to create a new item called "${itemName}"?</p>
          <p class="text-muted small">
            Please verify this is not a misspelling of an existing item name.
          </p>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="confirmAddItem">
            ${IconService.createIcon('Plus')}
            Add Item
          </button>
        </div>
      `
    });

    // Handle confirmation
    const confirmBtn = modal.querySelector('#confirmAddItem');
    confirmBtn.addEventListener('click', async () => {
      try {
        const newItem = {
          id: crypto.randomUUID(),
          name: itemName,
          description: '',
          images: []
        };

        this.contents.push(newItem);
        this.contents.sort((a, b) => a.name.localeCompare(b.name));
        this.updateDatalist();
        
        // Set input value
        const input = this.container.querySelector('#contentItem');
        input.value = newItem.name;
        
        closeModal();
      } catch (error) {
        console.error('ContentsSelect: Error creating item', error);
        showErrorAlert(error.message || 'Failed to create item');
      }
    });

    // Handle cancel
    modal.querySelector('[data-dismiss="modal"]').addEventListener('click', () => {
      closeModal();
      // Clear the input
      const input = this.container.querySelector('#contentItem');
      input.value = '';
      input.focus();
    });
  }

  attachEventListeners() {
    const input = this.container.querySelector('#contentItem');
    
    // Track if we're currently processing an item change
    let isProcessing = false;
    
    const handleItemChange = async (e) => {
      // Prevent concurrent processing
      if (isProcessing) return;
      
      const value = e.target.value.trim();
      if (!value) return;

      try {
        isProcessing = true;
        
        const existingItem = this.contents.find(item => 
          item.name.toLowerCase() === value.toLowerCase()
        );
        
        if (existingItem) {
          // Use existing item
          input.value = existingItem.name;
        } else {
          // Show confirmation modal for new item
          this.showConfirmationModal(value);
        }

      } catch (error) {
        console.error('ContentsSelect: Error handling item:', error);
        input.value = ''; // Clear invalid input
        input.focus();
        throw error;
      } finally {
        isProcessing = false;
      }
    };

    // Handle datalist selection
    const handleInput = (e) => {
      if (e.inputType === 'insertReplacementText') {
        handleItemChange(e);
      }
    };
    
    // Clean up old listeners
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Add listeners to fresh input
    newInput.addEventListener('blur', handleItemChange);
    newInput.addEventListener('input', handleInput);
  }

  showError() {
    this.container.innerHTML = `
      <div class="mb-3">
        <label for="contentItem" class="form-label d-flex align-items-center gap-2">
          ${IconService.createIcon('Package')}
          Item
        </label>
        <input
          type="text"
          id="contentItem"
          class="form-control"
          placeholder="Enter item name..."
          required
          autocomplete="off"
          spellcheck="false"
        />
        <div class="invalid-feedback">
          Please specify the item
        </div>
      </div>
    `;
  }

  getValue() {
    const input = this.container.querySelector('#contentItem');
    const value = input.value.trim();
    
    if (!value) return null;

    const existingItem = this.contents.find(item => 
      item.name.toLowerCase() === value.toLowerCase()
    );

    return existingItem || {
      id: crypto.randomUUID(),
      name: value,
      description: '',
      images: []
    };
  }

  updateDatalist() {
    const datalist = this.container.querySelector('#contentSuggestions');
    if (datalist) {
      datalist.innerHTML = this.contents.map(item => `<option value="${item.name}">`).join('');
    }
  }
}