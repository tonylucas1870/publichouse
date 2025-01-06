/**
 * Handles Supabase errors and returns a standardized error object
 * @param {Error} error - The original error
 * @param {string} defaultMessage - Default message if error details are not available
 * @returns {Error} Standardized error object
 */
export function handleSupabaseError(error, defaultMessage = 'An error occurred') {
  // If it's already a handled error, return as is
  if (error.isHandled) return error;

  // Handle authentication errors
  if (error.status === 401 || error.message?.includes('JWT')) {
    const enhancedError = new Error('Please sign in to continue');
    enhancedError.isHandled = true;
    return enhancedError;
  }

  const enhancedError = new Error(error.message || defaultMessage);
  enhancedError.code = error.code;
  enhancedError.details = error.details;
  enhancedError.isHandled = true;

  // Map specific error codes to user-friendly messages
  if (error.code === '23503') {
    enhancedError.message = 'This item cannot be deleted as it is being used by other records';
  } else if (error.code === '42501') {
    enhancedError.message = 'You do not have permission to perform this action';
  } else if (error.code === '23505') {
    enhancedError.message = 'This item already exists';
  } else if (error.code === 'PGRST301') {
    enhancedError.message = 'Resource not found';
  } else if (error.code === '401') {
    enhancedError.message = 'Please sign in to continue';
  } else if (error.code === 'auth/invalid-email') {
    enhancedError.message = 'Please enter a valid email address';
  } else if (error.code === 'auth/wrong-password') {
    enhancedError.message = 'Incorrect password';
  } else if (error.code === 'auth/user-not-found') {
    enhancedError.message = 'No account found with this email';
  }

  return enhancedError;
}

/**
 * Checks if an error is a specific type
 * @param {Error} error - The error to check
 * @param {string} code - The error code to check for
 * @returns {boolean}
 */
export function isErrorType(error, code) {
  return error?.code === code;
}