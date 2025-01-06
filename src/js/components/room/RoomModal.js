import { IconService } from '../../services/IconService.js';
import { RoomDetails } from './RoomDetails.js';

export class RoomModal {
  static show(roomId, roomName, isAdmin = false) {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title d-flex align-items-center gap-2">
              ${IconService.createIcon('DoorClosed')}
              Room Details
            </h5>
            <button type="button" class="btn-close" data-dismiss="modal"></button>
          </div>
          <div class="modal-body px-4" id="roomDetailsContainer">
            <!-- Room details will be rendered here -->
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    // Initialize room details
    new RoomDetails('roomDetailsContainer', roomId, roomName, isAdmin);

    // Close modal events
    const closeModal = () => {
      console.debug('RoomModal: Closing modal');
      document.body.removeChild(modal);
      document.body.classList.remove('modal-open');
    };

    modal.querySelector('.btn-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      console.debug('RoomModal: Click event', {
        target: e.target,
        currentTarget: e.currentTarget,
        targetClasses: e.target.className,
        hasModalDialog: !!e.target.closest('.modal-dialog')
      });
      
      // Close if clicking outside the modal dialog
      if (!e.target.closest('.modal-dialog')) {
        console.debug('RoomModal: Closing on backdrop click');
        closeModal();
      }
    });
  }
}