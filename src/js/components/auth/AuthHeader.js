import { IconService } from '../../services/IconService.js';
import { AuthModal } from './AuthModal.js';
import { authStore } from '../../auth/AuthStore.js';
import { showErrorAlert } from '../../utils/alertUtils.js';

export class AuthHeader {
  constructor() {
    this.container = document.querySelector('nav .container');
    if (!this.container) {
      console.error('Navigation container not found');
      return;
    }

    this.initialize();
  }

  initialize() {
    // Create brand and auth buttons containers
    this.brand = this.createBrand();
    this.authButtons = document.createElement('div');
    this.authButtons.className = 'ms-auto d-flex align-items-center gap-2';
    
    // Clear existing content
    this.container.innerHTML = '';
    
    // Add elements to container
    this.container.appendChild(this.brand);
    this.container.appendChild(this.authButtons);
    
    // Add auth state listener
    authStore.addListener(() => this.render());
    
    // Initial render
    this.render();
  }

  createBrand() {
    const brand = document.createElement('a');
    brand.href = '/';
    brand.className = 'navbar-brand d-flex align-items-center gap-2';
    brand.innerHTML = `
      ${IconService.createIcon('Camera')}
      <span class="h3 mb-0">CleanFind</span>
    `;
    return brand;
  }

  render() {
    if (authStore.isAuthenticated()) {
      this.authButtons.innerHTML = `
        <button class="btn btn-outline-danger" id="signOutBtn">
          Sign Out
        </button>
      `;
      
      const signOutBtn = this.authButtons.querySelector('#signOutBtn');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
          try {
            await authStore.signOut();
          } catch (error) {
            showErrorAlert(error.message);
          }
        });
      }
    } else {
      this.authButtons.innerHTML = `
        <button class="btn btn-outline-primary me-2" id="signInBtn">
          Sign In
        </button>
        <button class="btn btn-primary" id="signUpBtn">
          Sign Up
        </button>
      `;
      
      const signInBtn = this.authButtons.querySelector('#signInBtn');
      const signUpBtn = this.authButtons.querySelector('#signUpBtn');
      
      if (signInBtn) {
        signInBtn.addEventListener('click', () => AuthModal.show('signin'));
      }
      
      if (signUpBtn) {
        signUpBtn.addEventListener('click', () => AuthModal.show('signup'));
      }
    }
  }
}