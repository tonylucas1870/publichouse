/**
 * Shows an alert message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of alert ('error' or 'success')
 */
function showAlert(message, type) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  alertDiv.style.zIndex = '1050';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  document.body.appendChild(alertDiv);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);

  // Handle manual dismiss
  alertDiv.querySelector('.btn-close').addEventListener('click', () => {
    alertDiv.remove();
  });
}

/**
 * Shows an error alert message
 * @param {string} message - The message to display
 */
export function showErrorAlert(message) {
  showAlert(message, 'danger');
}

/**
 * Shows a success alert message
 * @param {string} message - The message to display
 */
export function showSuccessAlert(message) {
  showAlert(message, 'success');
}