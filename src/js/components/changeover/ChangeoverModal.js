import { IconService } from '../../services/IconService.js';
import { Modal } from '../ui/Modal.js';
import { validateForm } from '../../utils/formUtils.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class ChangeoverModal {
  static async show(changeoverService) {
    try {
      // Fetch properties first
      const properties = await changeoverService.getProperties();
      
      const { modal, closeModal } = Modal.show({
        title: 'Schedule Changeover',
        content: `
          <form id="changeoverForm">
            <div class="mb-3">
              <label for="propertyId" class="form-label d-flex align-items-center gap-2">
                ${IconService.createIcon('Home')}
                Property
              </label>
              <select class="form-select" id="propertyId" name="propertyId" required>
                <option value="">Select a property...</option>
                ${properties.map(p => `
                  <option value="${p.id}">${p.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="mb-3">
              <label for="checkinDate" class="form-label d-flex align-items-center gap-2">
                ${IconService.createIcon('LogIn')}
                Check-in Date
              </label>
              <input type="date" class="form-control" id="checkinDate" name="checkinDate" required>
            </div>
            <div class="mb-3">
              <label for="checkoutDate" class="form-label d-flex align-items-center gap-2">
                ${IconService.createIcon('LogOut')}
                Check-out Date
              </label>
              <input type="date" class="form-control" id="checkoutDate" name="checkoutDate" required>
            </div>
            <div class="d-flex justify-content-end gap-2">
              <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Schedule</button>
            </div>
          </form>
        `
      });

      // Form validation rules
      const validationRules = {
        propertyId: (value) => {
          if (!value) return 'Please select a property';
          return null;
        },
        checkinDate: (value) => {
          const checkinDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (checkinDate < today) {
            return 'Check-in date cannot be in the past';
          }
          return null;
        },
        checkoutDate: (value, form) => {
          const checkoutDate = new Date(value);
          const checkinDate = new Date(form.checkinDate.value);
          
          if (checkoutDate <= checkinDate) {
            return 'Check-out date must be after check-in date';
          }
          return null;
        }
      };

      // Form submission
      const form = modal.querySelector('#changeoverForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const { isValid } = validateForm(form, validationRules);
        if (!isValid) return;

        try {
          await changeoverService.createChangeover({
            propertyId: form.propertyId.value,
            checkinDate: form.checkinDate.value,
            checkoutDate: form.checkoutDate.value
          });
          
          closeModal();
          window.location.reload();
        } catch (error) {
          console.error('Error scheduling changeover:', error);
          showErrorAlert('Failed to schedule changeover. Please try again.');
        }
      });

      // Close modal on cancel
      modal.querySelector('[data-dismiss="modal"]')?.addEventListener('click', closeModal);

      // Add date change handlers
      const checkinInput = form.checkinDate;
      const checkoutInput = form.checkoutDate;

      // Set min dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      checkinInput.min = today.toISOString().split('T')[0];

      checkinInput.addEventListener('change', () => {
        // Set minimum checkout date to day after checkin
        const checkinDate = new Date(checkinInput.value);
        const minCheckout = new Date(checkinDate);
        minCheckout.setDate(minCheckout.getDate() + 1);
        checkoutInput.min = minCheckout.toISOString().split('T')[0];
        
        // Clear checkout if it's now invalid
        if (new Date(checkoutInput.value) <= new Date(checkinInput.value)) {
          checkoutInput.value = '';
        }

        validateForm(form, validationRules);
      });

      checkoutInput.addEventListener('change', () => {
        validateForm(form, validationRules);
      });
    } catch (error) {
      console.error('Error showing changeover modal:', error);
      showErrorAlert('Failed to load properties. Please try again.');
    }
  }
}