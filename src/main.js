import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './index.css'; // Import after Bootstrap to ensure our styles take precedence
import { App } from './js/app.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  App.initialize().catch(error => {
    console.error('Failed to initialize application:', error);
    document.body.innerHTML = `
      <div class="container py-5">
        <div class="alert alert-danger">
          Failed to initialize application. Please try refreshing the page.
        </div>
      </div>
    `;
  });
});