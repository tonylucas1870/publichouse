import { IconService } from '../../services/IconService';

export class Modal {
  static show({ title, content, size = 'default' }) {
    console.debug('Modal: Creating new modal', { title, size });
    
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    
    const dialogClass = size === 'large' ? 'modal-lg' : 
                       size === 'small' ? 'modal-sm' : '';

    modal.innerHTML = `
      <div class="modal-dialog ${dialogClass}">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    // Track modal state
    let isClosing = false;

    const closeModal = () => {
      // Prevent multiple close attempts
      if (isClosing) return;
      isClosing = true;

      try {
        console.debug('Modal: Closing modal');
        // Remove event listeners
        document.removeEventListener('keydown', handleEsc);
        modal.removeEventListener('click', handleBackdropClick);
        
        // Only remove if modal is still in DOM
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }

        // Always cleanup body class
        document.body.classList.remove('modal-open');
      } catch (error) {
        console.error('Modal: Error closing modal:', error);
        // Always cleanup body class
        document.body.classList.remove('modal-open');
      } finally {
        isClosing = false;
      }
    };

    const handleEsc = (e) => {
      console.debug('Modal: ESC key pressed', { key: e.key });
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    const handleBackdropClick = (e) => {
      console.debug('Modal: Click event', {
        target: e.target,
        currentTarget: e.currentTarget,
        isButton: e.target.tagName === 'BUTTON',
        isModalDialog: !!e.target.closest('.modal-dialog'),
        isModalBackdrop: e.target === modal
      });
      
      // Only close if clicking directly on the modal backdrop
      if (e.target === modal && e.target === e.currentTarget) {
        console.debug('Modal: Closing on backdrop click');
        closeModal();
      }
    };

    console.debug('Modal: Attaching event listeners');
    document.addEventListener('keydown', handleEsc);
    modal.addEventListener('click', handleBackdropClick);
    
    // Handle close/cancel buttons
    const closeBtn = modal.querySelector('.btn-close');
    const cancelBtn = modal.querySelector('[data-dismiss="modal"]');

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling to backdrop
        console.debug('Modal: Close button clicked');
        closeModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from bubbling to backdrop
        console.debug('Modal: Cancel button clicked');
        closeModal();
      });
    }

    return { modal, closeModal };
  }
}