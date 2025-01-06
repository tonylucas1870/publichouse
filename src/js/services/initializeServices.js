import { FindingsService } from './FindingsService.js';
import { ChangeoverService } from './ChangeoverService.js';
import { PropertyService } from './PropertyService.js';
import { IconService } from './IconService.js';
import { authStore } from '../auth/AuthStore.js';

export async function initializeServices() {
  try {
    // Initialize auth first and wait for it
    await authStore.initialize();
    
    // Initialize other services
    IconService.initialize();
    
    // Create service instances
    const findingsService = new FindingsService();
    const changeoverService = new ChangeoverService();
    const propertyService = new PropertyService();

    // Return initialized services
    return {
      findings: findingsService,
      changeover: changeoverService,
      property: propertyService
    };
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw new Error('Failed to initialize application services');
  }
}