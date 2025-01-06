import { PropertyDetails } from '../components/property/PropertyDetails.js';
import { authStore } from '../auth/AuthStore.js';

export async function initializePropertyView(services, elements, propertyId) {
  if (!authStore.isAuthenticated()) {
    throw new Error('Please sign in to view property details');
  }

  elements.propertyDetails.style.display = 'block';
  const propertyDetails = new PropertyDetails('propertyDetails');
  await propertyDetails.initialize(propertyId);
}