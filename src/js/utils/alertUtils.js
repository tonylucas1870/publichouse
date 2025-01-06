/**
 * Shows an alert message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of alert ('error' or 'success')
 */
export function showErrorAlert(message, type = 'error') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
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