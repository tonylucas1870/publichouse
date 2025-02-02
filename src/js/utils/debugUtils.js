/**
 * Debug logging utility
 */
export class DebugLogger {
  static log(component, action, data = null) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [${component}] ${action}`;
    const cleanedData = data ? this.sanitizeData(data) : null;
    
    console.log(message);
    if (cleanedData) {
      console.log('Data:', cleanedData);
    }
  }

  static error(component, action, error) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [${component}] ${action} ERROR:`;
    const errorDetails = {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : undefined
    };
    
    console.error(message);
    console.error('Error Details:', errorDetails);
  }

  // Sanitize data for logging to prevent circular references
  static sanitizeData(data, depth = 0) {
    if (depth > 3) return '[Max Depth Exceeded]';
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item, depth + 1));
    }

    if (data instanceof Error) {
      return {
        message: data.message,
        code: data.code,
        details: data.details,
        hint: data.hint
      };
    }

    if (data instanceof Date) {
      return data.toISOString();
    }

    if (typeof data === 'object') {
      const clean = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip internal properties and functions
        if (key.startsWith('_') || typeof value === 'function') continue;
        clean[key] = this.sanitizeData(value, depth + 1);
      }
      return clean;
    }

    return data;
  }
}