import { IconService } from '../../services/IconService.js';
import { formatDateTime } from '../../utils/dateUtils.js';
import { supabase } from '../../lib/supabase.js';
import { authStore } from '../../auth/AuthStore.js';

export class FindingNotes {
  static async render(notes = []) {
    // Get display names for authenticated users
    const userIds = notes
      .filter(note => note.author?.type === 'authenticated')
      .map(note => note.author.id);

    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('user_id, display_name')
      .in('user_id', userIds);

    const displayNames = new Map(
      userSettings?.map(settings => [settings.user_id, settings.display_name]) || []
    );

    return `
      <h6 class="d-flex align-items-center gap-2 mb-3">
        ${IconService.createIcon('MessageSquare')}
        Notes
      </h6>

      ${notes.length > 0 ? `
        <div class="list-group list-group-flush mb-3">
          ${notes.map(note => {
            // Handle both old and new note formats
            let authorName = 'Anonymous User';
            if (note.author) {
              if (note.author.type === 'authenticated') {
                // Use current display name from settings
                authorName = displayNames.get(note.author.id) || note.author.display_name;
              } else {
                authorName = note.author.display_name;
              }
            }

            return `
              <div class="list-group-item px-0">
                <p class="mb-1">${note.text}</p>
                <small class="text-muted d-flex align-items-center gap-2">
                  ${IconService.createIcon('Users', { width: '14', height: '14' })}
                  ${authorName}
                  <span class="ms-2 d-flex align-items-center gap-1">
                    ${IconService.createIcon('Clock', { width: '14', height: '14' })}
                    ${formatDateTime(note.created_at)}
                  </span>
                </small>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
      
      <form class="add-note-form mt-3">
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
    `;
  }
}