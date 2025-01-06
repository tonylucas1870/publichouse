import { supabase } from '../lib/supabase.js';
import { handleAuthError } from './authErrors.js';

class AuthStore {
  constructor() {
    this.currentUser = null;
    this.listeners = new Set();
    this.initialized = false;
    this.initializationPromise = null;
  }

  async initialize() {
    // Return existing initialization if already in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Skip if already initialized
    if (this.initialized) {
      return;
    }

    this.initializationPromise = new Promise(async (resolve) => {
      try {
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        // Set initial user
        this.currentUser = session?.user || null;

        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          const previousUser = this.currentUser;
          this.currentUser = session?.user || null;
          
          // Only notify if user state actually changed
          if (previousUser?.id !== this.currentUser?.id) {
            this.notifyListeners();
            // Reload page on auth state change
            window.location.reload();
          }
        });

        this.initialized = true;
        this.notifyListeners();
        resolve();
      } catch (error) {
        console.error('Auth initialization error:', error);
        this.currentUser = null;
        this.initialized = true;
        resolve();
      } finally {
        this.initializationPromise = null;
      }
    });

    return this.initializationPromise;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  addListener(callback) {
    this.listeners.add(callback);
    if (this.initialized) {
      callback(this.currentUser);
    }
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentUser);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  }

  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw handleAuthError(error);
    }
  }

  async signUp(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      if (error) throw error;
      return data;
    } catch (error) {
      throw handleAuthError(error);
    }
  }

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw handleAuthError(error);
    }
  }
}

export const authStore = new AuthStore();