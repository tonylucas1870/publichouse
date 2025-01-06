import { getStatusText } from '../../utils/statusUtils.js';

export class StatusSelect {
  static render(currentStatus, isEditable = true) {
    const statuses = [
      { value: 'pending', label: 'Pending' },
      { value: 'fixed', label: 'Fixed' },
      { value: 'wont_fix', label: 'Won\'t Fix' }
    ];

    if (!isEditable) {
      return `
        <div class="form-control-plaintext">
          ${getStatusText(currentStatus)}
        </div>
      `;
    }

    return `
      <select class="form-select status-select">
        ${statuses.map(status => `
          <option value="${status.value}" ${status.value === currentStatus ? 'selected' : ''}>
            ${status.label}
          </option>
        `).join('')}
      </select>
    `;
  }

  static getValue(element) {
    return element.querySelector('.status-select')?.value;
  }

  static attachEventListeners(element, onChange) {
    const select = element.querySelector('.status-select');
    if (select) {
      select.addEventListener('change', (e) => onChange(e.target.value));
    }
  }
}