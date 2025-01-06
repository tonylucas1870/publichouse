import { authStore } from './AuthStore';

export class AuthService {
  isAuthenticated() {
    return authStore.isAuthenticated();
  }

  addAuthListener(callback) {
    authStore.addListener(callback);
  }

  removeAuthListener(callback) {
    authStore.removeListener(callback);
  }

  signIn(email, password) {
    return authStore.signIn(email, password);
  }

  signUp(email, password) {
    return authStore.signUp(email, password);
  }

  signOut() {
    return authStore.signOut();
  }
}