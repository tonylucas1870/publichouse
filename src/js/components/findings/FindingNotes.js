import { IconService } from '../../services/IconService.js';
import { formatDateTime } from '../../utils/dateUtils.js';
import { authStore } from '../../auth/AuthStore.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class FindingNotes {
  static render(notes = []) {
    return `
      <div class="finding-notes mt-3">
        <h6 class="d-flex align-items-center gap-2 mb-3">
          ${IconService.createIcon('MessageSquare')}
          Notes
        </h6>

        ${notes.length > 0 ? `
          <div class="list-group list-group-flush mb-3">
            ${notes.map(note => `
              <div class="list-group-item px-0">
                <p class="mb-1">${note.text}</p>
                <small class="text-muted d-flex align-items-center gap-2">
                  ${IconService.createIcon('Users', { width: '14', height: '14' })}
                  ${note.user_email}
                  <span class="ms-2 d-flex align-items-center gap-1">
                    ${IconService.createIcon('Clock', { width: '14', height: '14' })}
                    ${formatDateTime(note.created_at)}
                  </span>
                </small>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${authStore.isAuthenticated() ? `
          <form class="add-note-form">
            <div class="input-group">
              <input type="text" 
                     class="form-control" 
                     placeholder="Add a note..."
                     required>
              <button class="btn btn-outline-primary" type="submit">
                Add Note
              </button>
            </div>
          </form>
        ` : ''}
      </div>
    `;
  }

  static attachEventListeners(container, onAddNote) {
    const form = container.querySelector('.add-note-form');
    if (form) {
      const submitButton = form.querySelector('button[type="submit"]');
      
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Disable submit button while processing
        if (submitButton) {
          submitButton.disabled = true;
        }
        
        const input = form.querySelector('input');
        const text = input.value.trim();
        
        if (text) {
          try {
            await onAddNote(text);
            // Only clear input on success
            input.value = '';
          } catch (error) {
            console.error('Error adding note:', error);
            showErrorAlert('Failed to add note. Please try again.');
          }
        }
        
        // Re-enable submit button
        if (submitButton) {
          submitButton.disabled = false;
        }
      });
    }
  }
}