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

    const closeModal = () => {
      console.debug('Modal: Closing modal');
      document.removeEventListener('keydown', handleEsc);
      modal.removeEventListener('click', handleBackdropClick);
      
      document.body.removeChild(modal);
      document.body.classList.remove('modal-open');
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
        isModalClick: e.target === modal,
        targetClasses: e.target.className,
        modalClasses: modal.className
      });
      
      // Close if clicking outside the modal dialog
      if (!e.target.closest('.modal-dialog')) {
        console.debug('Modal: Closing on backdrop click');
        closeModal();
      }
    };

    console.debug('Modal: Attaching event listeners');
    document.addEventListener('keydown', handleEsc);
    modal.addEventListener('click', handleBackdropClick);
    modal.querySelector('.btn-close').addEventListener('click', () => {
      console.debug('Modal: Close button clicked');
      closeModal();
    });

    return { modal, closeModal };
  }
}