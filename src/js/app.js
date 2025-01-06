import { initializeViews } from './views/initializeViews.js';
import { initializeServices } from './services/initializeServices.js';
import { showErrorAlert } from './utils/alertUtils.js';

export class App {
  static async initialize() {
    try {
      // Initialize services
      const services = await initializeServices();
      
      // Initialize views
      await initializeViews(services);
    } catch (error) {
      console.error('Error initializing app:', error);
      showErrorAlert(error.message || 'Failed to initialize application');
      throw error; // Re-throw to show error page
    }
  }
}