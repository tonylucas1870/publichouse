export class ErrorDisplay {
  static render(message, type = 'error') {
    const className = type === 'error' ? 'alert-danger' : 'alert-info';
    return `
      <div class="alert ${className}">
        ${message}
      </div>
    `;
  }
}