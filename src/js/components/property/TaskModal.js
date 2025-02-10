import { IconService } from '../../services/IconService.js';
import { Modal } from '../ui/Modal.js';
import { validateForm } from '../../utils/formUtils.js';
import { showErrorAlert } from '../../utils/alertUtils.js';
import { uploadFile } from '../../utils/storageUtils.js';
import { validateMedia } from '../../utils/imageUtils.js';
import { isVideo, renderMediaThumbnail } from '../../utils/mediaUtils.js';

export class TaskModal {
  static show(task = null, propertyId, taskService, onSave) {
    const { modal, closeModal } = Modal.show({
      title: task ? 'Edit Task' : 'Add Task',
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
            <input type="text" class="form-control" id="location"
                   value="${task?.location || ''}" required>
          </div>

          <div class="mb-4">
            <label for="description" class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('AlignLeft')}
              Description (Optional)
            </label>
            <textarea class="form-control" id="description" rows="3">${task?.description || ''}</textarea>
          </div>

          <div class="mb-4">
            <label class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Image')}
              Images/Videos
            </label>
            
            <div class="card">
              <div class="card-body">
                <div class="row g-2 mb-3" id="imagePreviewsContainer">
                  ${(task?.images || []).map((image, index) => `
                    <div class="col-4 col-md-3">
                      <div class="position-relative">
                        ${renderMediaThumbnail({ 
                          url: image, 
                          size: 'medium',
                          showPlayIcon: isVideo(image)
                        })}
                        <button type="button" 
                                class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-image"
                                data-index="${index}">
                          ${IconService.createIcon('X')}
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
                
                <input type="file" id="taskImages" class="d-none" accept="image/*,video/*" multiple>
                <button type="button" class="btn btn-outline-primary btn-sm w-100" id="addImagesBtn">
                  ${IconService.createIcon('Upload')}
                  Add Images/Videos
                </button>
              </div>
            </div>
          </div>

          <div class="mb-4">
            <label class="form-label d-flex align-items-center gap-2">
              ${IconService.createIcon('Clock')}
              Schedule Task
            </label>
            
            <div class="card">
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-12">
                    <div class="input-group">
                      <span class="input-group-text">Run every</span>
                      <input type="number" class="form-control" id="interval" 
                             min="1" step="1" style="max-width: 100px"
                             value="${task?.interval || 1}">
                      <select class="form-select" id="schedulingType" style="max-width: 150px">
                        <option value="">Every time</option>
                        <option value="changeover" ${task?.scheduling_type === 'changeover' ? 'selected' : ''}>
                          Changeover${task?.interval !== 1 ? 's' : ''}
                        </option>
                        <option value="month" ${task?.scheduling_type === 'month' ? 'selected' : ''}>
                          Month${task?.interval !== 1 ? 's' : ''}
                        </option>
                      </select>
                    </div>
                    <div class="form-text">
                      Leave empty to run the task every time
                    </div>
                  </div>
                </div>

                ${task?.last_executed ? `
                  <div class="mt-3 pt-3 border-top">
                    <small class="text-muted d-flex align-items-center gap-1">
                      ${IconService.createIcon('Info', { width: '14', height: '14' })}
                      Last executed: ${new Date(task.last_executed).toLocaleDateString()}
                    </small>
                  </div>
                ` : ''}
              </div>
            </div>
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

    // Track current images
    let currentImages = [...(task?.images || [])];

    // Handle image upload
    const imageInput = modal.querySelector('#taskImages');
    const addImagesBtn = modal.querySelector('#addImagesBtn');
    const imagePreviewsContainer = modal.querySelector('#imagePreviewsContainer');

    const updateImagePreviews = () => {
      imagePreviewsContainer.innerHTML = currentImages.map((image, index) => `
        <div class="col-4 col-md-3">
          <div class="position-relative">
            ${renderMediaThumbnail({ 
              url: image, 
              size: 'medium',
              showPlayIcon: isVideo(image)
            })}
            <button type="button" 
                    class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 remove-image"
                    data-index="${index}">
              ${IconService.createIcon('X')}
            </button>
          </div>
        </div>
      `).join('');

      // Reattach remove buttons
      imagePreviewsContainer.querySelectorAll('.remove-image').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const index = parseInt(btn.dataset.index);
          currentImages.splice(index, 1);
          updateImagePreviews();
        });
      });
    };

    if (addImagesBtn) {
      addImagesBtn.addEventListener('click', () => imageInput.click());
    }

    if (imageInput) {
      imageInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Validate files
        for (const file of files) {
          const error = validateMedia(file);
          if (error) {
            showErrorAlert(error);
            return;
          }
        }

        try {
          // Disable button while uploading
          addImagesBtn.disabled = true;
          addImagesBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Uploading...
          `;

          // Upload all files
          const uploadedUrls = await Promise.all(
            files.map(file => uploadFile('tasks', file))
          );
          
          // Add new URLs to current images
          currentImages = [
            ...currentImages,
            ...uploadedUrls.map(({ publicUrl }) => publicUrl)
          ];

          // Update previews
          updateImagePreviews();
        } catch (error) {
          console.error('Error uploading images:', error);
          showErrorAlert('Failed to upload images. Please try again.');
        } finally {
          // Reset button state
          addImagesBtn.disabled = false;
          addImagesBtn.innerHTML = `
            ${IconService.createIcon('Upload')}
            Add Images/Videos
          `;
        }
      });
    }

    // Handle scheduling rule toggles
    const useChangeoverInterval = modal.querySelector('#useChangeoverInterval');
    const changeoverIntervalGroup = modal.querySelector('#changeoverIntervalGroup');
    const useMonthInterval = modal.querySelector('#useMonthInterval');
    const monthIntervalGroup = modal.querySelector('#monthIntervalGroup');

    useChangeoverInterval?.addEventListener('change', (e) => {
      changeoverIntervalGroup.classList.toggle('d-none', !e.target.checked);
    });

    useMonthInterval?.addEventListener('change', (e) => {
      monthIntervalGroup.classList.toggle('d-none', !e.target.checked);
    });

    // Form submission
    const form = modal.querySelector('#taskForm');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const { isValid } = validateForm(form);
      if (!isValid) return;

      // Get scheduling values
      const schedulingType = form.schedulingType.value || null;
      const interval = schedulingType ? Math.max(1, parseInt(form.interval.value)) : null;

      // Create task data
      const taskData = {
        propertyId, // Ensure we're passing propertyId from the modal
        property_id: propertyId,
        title: form.title.value.trim(),
        description: form.description.value.trim() || null,
        location: form.location.value.trim(),
        scheduling_type: schedulingType,
        interval: interval,
        images: currentImages || []
      };

      console.debug('TaskModal: Submitting task data', {
        propertyId,
        taskData,
        isUpdate: !!task
      });
      try {
        // If this is an update, update images separately
        if (task?.id) {
          await taskService.updateTaskImages(task.id, currentImages);
          const { images, ...taskDetails } = taskData;
          await onSave(taskDetails);
        } else {
          await onSave(taskData);
        }

        closeModal();
        showErrorAlert(`Task ${task ? 'updated' : 'added'} successfully`, 'success');
      } catch (error) {
        console.error('Error saving task:', error);
        showErrorAlert(error.message);
      }
    });

    // Handle cancel button click
    modal.querySelector('[data-dismiss="modal"]')?.addEventListener('click', closeModal);
  }
}