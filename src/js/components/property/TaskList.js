import { IconService } from '../../services/IconService.js';
import { TaskModal } from './TaskModal.js';
import { formatDate } from '../../utils/dateUtils.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class TaskList {
  constructor(containerId, propertyId, taskService) {
    this.container = document.getElementById(containerId);
    this.propertyId = propertyId;
    this.taskService = taskService;
    this.tasks = [];
    this.filteredTasks = []; // Initialize filtered tasks array
    this.currentView = localStorage.getItem('taskView') || 'list';
    this.sortField = 'title';
    this.sortDirection = 'asc';
    this.searchTerm = '';
    this.itemsPerPage = 10;
    this.currentPage = 1;
  }

  async initialize() {
    try {
      this.tasks = await this.taskService.getTasks(this.propertyId);
      this.filteredTasks = [...this.tasks]; // Initialize with all tasks
      this.applyFilters();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error loading tasks:', error);
      this.showError(error.message);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-3">
          <div class="input-group input-group-sm" style="width: 250px;">
            <span class="input-group-text bg-transparent border-end-0">
              ${IconService.createIcon('Search', { width: '16', height: '16' })}
            </span>
            <input type="text" 
                   class="form-control border-start-0" 
                   id="taskSearch"
                   placeholder="Search tasks..."
                   value="${this.searchTerm}">
          </div>
          
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary view-toggle ${this.currentView === 'list' ? 'active' : ''}" 
                    data-view="list" title="List View">
              ${IconService.createIcon('List')}
            </button>
            <button class="btn btn-outline-secondary view-toggle ${this.currentView === 'grid' ? 'active' : ''}" 
                    data-view="grid" title="Grid View">
              ${IconService.createIcon('Grid')}
            </button>
          </div>
        </div>

        <div class="d-flex align-items-center gap-2">
          <select class="form-select form-select-sm" id="taskSort" style="width: auto;">
            <option value="title" ${this.sortField === 'title' ? 'selected' : ''}>Name</option>
            <option value="location" ${this.sortField === 'location' ? 'selected' : ''}>Location</option>
            <option value="last_executed" ${this.sortField === 'last_executed' ? 'selected' : ''}>Last Run</option>
          </select>
          
          <button class="btn btn-outline-primary btn-sm" id="addTaskBtn">
            ${IconService.createIcon('Plus')}
            Add Task
          </button>
        </div>
      </div>

      ${this.filteredTasks.length === 0 ? `
        <div class="alert alert-info mb-0">
          ${this.searchTerm ? 'No tasks match your search.' : 'No standard tasks defined yet.'}
        </div>
      ` : `
        <div class="${this.currentView === 'grid' ? 'row g-3' : 'list-group list-group-flush'}">
          ${this.currentView === 'list' ? this.renderListHeader() : ''}
          ${this.getPaginatedTasks().map(task => 
            this.currentView === 'grid' ? 
              this.renderGridTask(task) : 
              this.renderListTask(task)
          ).join('')}
        </div>

        ${this.renderPagination()}
      `}
    `;
  }

  renderListTask(task) {
    let scheduleText = '';
    if (task.scheduling_type) {
      const unit = task.scheduling_type === 'changeover' ? 'changeover' : 'month';
      scheduleText = `Every ${task.interval} ${unit}${task.interval > 1 ? 's' : ''}`;
    }

    return `
      <div class="list-group-item task-item py-2" data-task-id="${task.id}" style="cursor: pointer">
        <div class="d-flex align-items-center gap-3">
          <div class="fw-medium" style="width: 25%">${task.title}</div>
          <div class="text-muted" style="width: 20%">${task.location}</div>
          <div class="text-muted small" style="width: 25%">${task.description || '-'}</div>
          <div class="text-muted small" style="width: 20%">
            ${scheduleText ? `
              <span class="badge bg-info bg-opacity-10 text-info">
                ${IconService.createIcon('Clock', { width: '14', height: '14' })}
                <span class="ms-1">${scheduleText}</span>
              </span>
            ` : '-'}
          </div>
          <div class="text-muted small" style="width: 20%">
            ${task.last_executed ? formatDate(task.last_executed) : '-'}
          </div>
          <div class="ms-auto">
            <button class="btn btn-outline-danger btn-sm delete-task"
                    data-task-id="${task.id}"
                    onclick="event.stopPropagation()">
              ${IconService.createIcon('Trash2')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderListHeader() {
    return `
      <div class="list-group-item bg-light py-2">
        <div class="d-flex align-items-center gap-3">
          <div class="fw-medium" style="width: 25%">Task Name</div>
          <div class="fw-medium" style="width: 20%">Location</div>
          <div class="fw-medium" style="width: 25%">Description</div>
          <div class="fw-medium" style="width: 20%">Schedule</div>
          <div class="fw-medium" style="width: 20%">Last Run</div>
          <div class="ms-auto" style="width: 40px"></div>
        </div>
      </div>
    `;
  }

  renderGridTask(task) {
    let scheduleText = '';
    if (task.scheduling_type) {
      const unit = task.scheduling_type === 'changeover' ? 'changeover' : 'month'; 
      scheduleText = task.interval > 1 ? 
        `Every ${task.interval} ${unit}s` : 
        `Every ${unit}`;
    }

    const hasMedia = task.images?.length > 0;

    return `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100">
          ${hasMedia ? `
            ${renderMediaThumbnail({ 
              url: task.images[0], 
              size: 'large',
              showPlayIcon: isVideo(task.images[0])
            })}
            ${task.images.length > 1 ? `
              <div class="position-absolute top-0 end-0 m-2">
                <span class="badge bg-dark bg-opacity-75">
                  +${task.images.length - 1} more
                </span>
              </div>
            ` : ''}
          ` : ''}
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <h6 class="card-title mb-0">${task.title}</h6>
              <button class="btn btn-outline-danger btn-sm delete-task" 
                      data-task-id="${task.id}">
                ${IconService.createIcon('Trash2')}
              </button>
            </div>
            
            <p class="card-text text-muted small mb-2">
              ${IconService.createIcon('MapPin', { width: '14', height: '14' })}
              <span class="ms-1">${task.location}</span>
            </p>
            
            ${task.description ? `
              <p class="card-text small text-muted mb-3">${task.description}</p>
            ` : ''}
            
            <div class="mt-auto">
              ${scheduleText ? `
                <span class="badge bg-info bg-opacity-10 text-info d-inline-flex align-items-center gap-1">
                  ${IconService.createIcon('Clock', { width: '14', height: '14' })}
                  ${scheduleText}
                </span>`
              : ''}
              ${task.last_executed ? `
                <div class="mt-2 text-muted small d-flex align-items-center gap-1">
                  ${IconService.createIcon('CheckCircle', { width: '14', height: '14' })}
                  Last run: ${formatDate(task.last_executed)}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredTasks.length / this.itemsPerPage);
    if (totalPages <= 1) return '';
    
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    return `
      <nav class="mt-4">
        <ul class="pagination pagination-sm justify-content-center mb-0">
          <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" data-page="${this.currentPage - 1}">Previous</button>
          </li>
          ${pageNumbers.map(i => `
            <li class="page-item ${i === this.currentPage ? 'active' : ''}">
              <button class="page-link" data-page="${i}">${i}</button>
            </li>
          `).join('')}
          <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
            <button class="page-link" data-page="${this.currentPage + 1}">Next</button>
          </li>
        </ul>
      </nav>
    `;
  }

  applyFilters() {
    // Filter tasks
    this.filteredTasks = this.tasks.filter(task => {
      if (!this.searchTerm.trim()) return true;
      const search = this.searchTerm.toLowerCase();
      return (
        task.title?.toLowerCase().includes(search) ||
        task.location?.toLowerCase().includes(search) ||
        (task.description?.toLowerCase() || '').includes(search)
      );
    });

    // Sort tasks
    this.filteredTasks.sort((a, b) => {
      const aVal = (a[this.sortField] || '').toString().toLowerCase();
      const bVal = (b[this.sortField] || '').toString().toLowerCase();

      // Compare based on sort direction
      const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return this.sortDirection === 'asc' ? result : -result;
    });
  }

  getPaginatedTasks() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredTasks.slice(start, end);
  }

  attachEventListeners() {
    // Search input
    const searchInput = this.container.querySelector('#taskSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        this.currentPage = 1;
        this.applyFilters();
        this.render();
        this.attachEventListeners();
      });
    }

    // Sort select
    const sortSelect = this.container.querySelector('#taskSort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortField = e.target.value;
        this.sortDirection = this.sortField === 'last_executed' ? 'desc' : 'asc';
        this.applyFilters();
        this.render();
        this.attachEventListeners();
      });
    }

    // View toggles
    this.container.querySelectorAll('.view-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentView = btn.dataset.view;
        localStorage.setItem('taskView', this.currentView);
        this.render();
        this.attachEventListeners();
      });
    });

    // Pagination
    this.container.querySelectorAll('.page-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const page = parseInt(btn.dataset.page);
        if (page >= 1 && page <= Math.ceil(this.filteredTasks.length / this.itemsPerPage)) {
          this.currentPage = page;
          this.render();
          this.attachEventListeners();
        }
      });
    });

    // Add task button
    const addTaskBtn = this.container.querySelector('#addTaskBtn');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => {
        TaskModal.show(null, this.propertyId, this.taskService, async (taskData) => {
          await this.taskService.addTask(taskData);
          await this.initialize();
        });
      });
    }

    // Edit task
    this.container.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.taskId;
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
          TaskModal.show(task, this.propertyId, this.taskService, async (taskData) => {
            try {
              // Extract scheduling data
              const { scheduling_type, interval, ...taskDetails } = taskData;
              
              // Update task details
              await this.taskService.updateTask(taskId, taskDetails);
              
              // Update scheduling separately
              await this.taskService.updateTaskScheduling(taskId, {
                scheduling_type,
                interval
              });
            } catch (error) {
              console.error('Error updating task:', error);
              showErrorAlert(error.message);
              return;
            }

            await this.initialize();
          });
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

  showError(message) {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        ${message || 'Failed to load tasks'}
      </div>
    `;
  }
}