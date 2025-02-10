import { RoomDetailsService } from '../../services/RoomDetailsService.js';
import { IconService } from '../../services/IconService.js';
import { Modal } from './Modal.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class ContentsSelect {
  constructor(containerId, roomId) {
    console.debug('ContentsSelect: Constructor', { containerId, roomId });
    this.container = document.getElementById(containerId);
    this.roomId = roomId;
    this.roomDetailsService = new RoomDetailsService();
    this.contents = [];
    this.pendingValue = null;
    this.isInitialized = false;
    this.initializePromise = null;
    this.retryAttempts = 0;
    this.maxRetries = 10;
    this.retryDelay = 200;
  }

  async initialize() {
    try {
      console.debug('ContentsSelect: Initializing');
      
      if (this.initializePromise) {
        console.debug('ContentsSelect: Already initializing, waiting for completion');
        await this.initializePromise;
        return;
      }

      this.initializePromise = (async () => {
        const details = await this.roomDetailsService.getRoomDetails(this.roomId);
        console.debug('ContentsSelect: Got room details', {
          roomId: this.roomId,
          contentsCount: details.contents?.length,
          contents: details.contents?.map(c => ({
            id: c.id,
            name: c.name,
            type: typeof c
          }))
        });

        this.contents = details.contents || [];
        this.render();
        this.attachEventListeners();
        this.isInitialized = true;

        // Set any pending value after initialization
        if (this.pendingValue) {
          console.debug('ContentsSelect: Setting pending value', { value: this.pendingValue });
          await this.setValueWithRetry(this.pendingValue);
          this.pendingValue = null;
        }
      })();

      await this.initializePromise;
      return this; // Return instance for chaining
    } catch (error) {
      console.error('Error loading room contents:', error);
      this.showError();
      throw error;
    }
  }

  async setValueWithRetry(value) {
    console.debug('ContentsSelect: Setting value with retry', {
      value,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
      isInitialized: this.isInitialized,
      contentsLength: this.contents.length,
      retryAttempts: this.retryAttempts,
      contents: this.contents.map(c => ({
        name: typeof c === 'string' ? c : c.name,
        type: typeof c
      }))
    });

    // Wait for initialization if needed
    if (!this.isInitialized) {
      console.debug('ContentsSelect: Waiting for initialization');
      await this.initializePromise;
    }

    while (this.retryAttempts < this.maxRetries) {
      try {
        if (this.contents.length > 0) {
          this._setValue(value);
          this.retryAttempts = 0; // Reset counter on success
          return true;
        }
        
        console.debug('ContentsSelect: Retry attempt', {
          attempt: this.retryAttempts + 1,
          contentsLength: this.contents.length
        });
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        this.retryAttempts++;

        // Reload contents on every other attempt
        if (this.retryAttempts % 2 === 0) {
          console.debug('ContentsSelect: Reloading contents during retry');
          const details = await this.roomDetailsService.getRoomDetails(this.roomId);
          this.contents = details.contents || [];
        }
      }
      catch (error) {
        console.error('Error setting value:', error);
        this.retryAttempts++;
      }
    }

    console.warn('ContentsSelect: Failed to set value after retries');
    this.retryAttempts = 0; // Reset counter
    return false;
  }

  _setValue(value) {
    console.debug('ContentsSelect: Internal setValue', {
      value,
      valueType: typeof value,
      isObject: value instanceof Object,
      hasName: value?.name !== undefined,
      contents: this.contents.map(c => ({
        name: typeof c === 'string' ? c : c.name,
        type: typeof c,
        isObject: c instanceof Object
      }))
    });

    const input = this.container.querySelector('#contentItem');
    if (!input) {
      throw new Error('Input element not found');
    }

    if (!value) {
      input.value = '';
      return;
    }

    // Normalize search value
    const searchValue = (typeof value === 'string' ? value :
                        value?.name || String(value)).toLowerCase().trim();

    // Find matching content item
    const item = this.contents.find(i => {
      const itemName = (typeof i === 'string' ? i : i.name || '').toLowerCase().trim();
      return itemName === searchValue;
    });

    if (item) {
      input.value = typeof item === 'string' ? item : item.name;
      console.debug('ContentsSelect: Set input value', {
        value: input.value,
        originalItem: item
      });
    } else {
      // Show confirmation for new item
      console.debug('ContentsSelect: No match found, showing confirmation');
      this.showConfirmationModal(searchValue);
    }
  }

  setValue(value) {
    console.debug('ContentsSelect: Setting value', { 
      value,
      isInitialized: this.isInitialized,
      hasPendingValue: !!this.pendingValue,
      contentsLength: this.contents.length
    });

    // If not initialized, store as pending value
    if (!this.isInitialized) {
      console.debug('ContentsSelect: Not initialized, storing pending value');
      this.pendingValue = value;
      return;
    }

    // Use retry mechanism to set value
    this.setValueWithRetry(value).catch(error => {
      console.error('Failed to set value:', error);
      showErrorAlert('Failed to set content item');
    });
  }

  render() {
    console.debug('ContentsSelect: Rendering', {
      contentCount: this.contents.length,
      contents: this.contents.map(c => c.name)
    });
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
    console.debug('ContentsSelect: Getting value', { 
      inputValue: value,
      contents: this.contents.map(c => ({
        name: typeof c === 'string' ? c : c.name,
        type: typeof c,
        isObject: c instanceof Object
      }))
    });
    
    if (!value) return null;

    const existingItem = this.contents.find(item => {
      // Normalize item name
      const itemName = (typeof item === 'string' ? item : item.name || '').toLowerCase().trim();
      const searchValue = value.toLowerCase().trim();

      console.debug('ContentsSelect: Comparing items', {
        itemName,
        searchValue,
        match: itemName === searchValue,
        itemType: typeof item,
        isObject: item instanceof Object,
        fullItem: item instanceof Object ? { ...item } : item
      });

      return itemName === searchValue;
    });

    console.debug('ContentsSelect: getValue result', {
      value,
      existingItem: existingItem && {
        name: typeof existingItem === 'string' ? existingItem : existingItem.name,
        type: typeof existingItem,
        isObject: existingItem instanceof Object,
        fullItem: existingItem instanceof Object ? { ...existingItem } : existingItem
      }
    });

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