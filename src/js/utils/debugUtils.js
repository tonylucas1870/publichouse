/**
 * Debug logging utility
 */
export class DebugLogger {
  static log(component, action, data = null) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [${component}] ${action}`;
    
    console.log(message);
    if (data) {
      console.log('Data:', data);
    }
  }

  static error(component, action, error) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [${component}] ${action} ERROR:`;
    
    console.error(message);
    console.error('Error:', error);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}