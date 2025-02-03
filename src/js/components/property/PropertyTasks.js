import { IconService } from '../../services/IconService.js';
import { PropertyTaskService } from '../../services/PropertyTaskService.js';
import { RoomSelect } from '../ui/RoomSelect.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { Modal } from '../ui/Modal.js';

export class PropertyTasks {
  constructor(containerId, propertyId) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    this.taskService = new PropertyTaskService();
    this.tasks = [];
    this.initialize();
  }

  async initialize() {
    try {
      this.tasks = await this.taskService.getTasks(this.propertyId);
      const isAdmin = this.container.dataset.isAdmin === 'true';
      this.isAdmin = isAdmin;
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading tasks:', error);
      this.showError();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            ${IconService.createIcon('ListChecks')}
            <h3 class="h5 mb-0">Standard Tasks</h3>
          </div>
          ${this.isAdmin ? `
            <button class="btn btn-outline-primary btn-sm" id="addTaskBtn">
              ${IconService.createIcon('Plus')}
              Add Task
            </button>
          ` : ''}
        </div>
        <div class="card-body">
          ${this.renderTasksList()}
        </div>
      </div>
    `;
  }

  renderTasksList() {
    if (!this.tasks.length) {
      return `
        <div class="alert alert-info mb-0">
          No standard tasks defined yet.
        </div>
      `;
    }

    return `
      <div class="list-group list-group-flush">
        ${this.tasks.map(task => `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-start">
              <div class="task-item" data-task-id="${task.id}" style="cursor: pointer; flex: 1">
                <h6 class="mb-1">${task.title}</h6>
                <p class="mb-1 text-muted small">Location: ${task.location}</p>
                ${task.description ? `
                  <p class="mb-0 text-muted"><small>${task.description}</small></p>
                ` : ''}
              </div>
              ${this.isAdmin ? `
                <button class="btn btn-outline-danger btn-sm delete-task" 
                        data-task-id="${task.id}">
                  ${IconService.createIcon('Trash2')}
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  showTaskModal(task = null) {
    const { modal, closeModal } = Modal.show({
      title: task ? 'Edit Task' : 'Add Task',
      size: 'large',
      content: `
        <form id="taskForm">
          <div class="mb-3">
            <label for="title" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Type')}
              Title
            </label>
            <input type="text" class="form-control" id="title" 
                   value="${task?.title || ''}" required>
          </div>

          <div class="mb-3">
            <label for="location" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('MapPin')}
              Location
            </label>
            <div id="roomSelectContainer"></div>
          </div>

          <div class="mb-4">
            <label for="description" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('AlignLeft')}
              Description (Optional)
            </label>
            <textarea class="form-control" id="description" rows="3">${task?.description || ''}</textarea>
          </div>

          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">
              ${task ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      `
    });

    // Initialize room select
    const roomSelect = new RoomSelect('roomSelectContainer', this.propertyId);
    
    // If editing, set initial room value immediately
    if (task?.location) {
      console.debug('PropertyTasks: Setting initial room value', { location: task.location });
      roomSelect.setValue(task.location);
    }

    const form = modal.querySelector('#taskForm');
    const cancelBtn = modal.querySelector('[data-dismiss="modal"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const location = roomSelect.getValue();
      if (!location) {
        showErrorAlert('Please select or enter a room');
        return;
      }

      const formData = {
        title: form.title.value.trim(),
        location,
        description: form.description.value.trim() || null,
        propertyId: this.propertyId
      };

      try {
        if (task) {
          await this.taskService.updateTask(task.id, formData);
        } else {
          await this.taskService.addTask(formData);
        }
        
        await this.initialize();
        closeModal();
        showErrorAlert(`Task ${task ? 'updated' : 'added'} successfully`, 'success');
      } catch (error) {
        showErrorAlert(error.message);
      }
    });

    // Handle cancel button click
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        console.debug('PropertyTasks: Cancel button clicked');
        // Clear any pending room changes
        roomSelect.reset();
        closeModal();
      });
    }

    // Handle close button click
    modal.querySelector('.btn-close').addEventListener('click', () => {
      // Clear any pending room changes
      roomSelect.reset();
      closeModal();
    });

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        roomSelect.reset();
        closeModal();
      }
    });
  }

  attachEventListeners() {
    // Add task button
    const addTaskBtn = this.container.querySelector('#addTaskBtn');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => this.showTaskModal());
    }

    // Edit task
    this.container.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.taskId;
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          this.showTaskModal(task);
        }
      });
    });

    // Delete task
    this.container.querySelectorAll('.delete-task').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.taskId;
        if (confirm('Are you sure you want to delete this task?')) {
          try {
            await this.taskService.deleteTask(taskId);
            await this.initialize();
            showErrorAlert('Task deleted successfully', 'success');
          } catch (error) {
            showErrorAlert(error.message);
          }
        }
      });
    });
  }

  showError() {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        Failed to load tasks. Please try again later.
      </div>
    `;
  }
}