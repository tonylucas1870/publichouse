const AUTH_ERROR_MESSAGES = {
  'email not confirmed': 'Please check your email to confirm your account',
  'invalid login credentials': 'Invalid email or password',
  'email already registered': 'This email is already registered',
  'invalid email': 'Please enter a valid email address',
  'weak password': 'Password is too weak. It should be at least 6 characters long',
  'user not found': 'No account found with this email'
};

export function handleAuthError(error) {
  console.error('Auth error:', error);
  
  // If error is already handled, return as is
  if (error.isHandled) return error;

  const message = error.message?.toLowerCase() || '';
  
  // Check for known error messages
  for (const [key, value] of Object.entries(AUTH_ERROR_MESSAGES)) {
    if (message.includes(key)) {
      const enhancedError = new Error(value);
      enhancedError.isHandled = true;
      return enhancedError;
    }
  }
  
  // Handle initialization errors differently
  if (error.status === 400 && message.includes('initialization')) {
    return null; // Not a real error during initialization
  }
  
  // Default error message
  const enhancedError = new Error('Authentication failed. Please try again.');
  enhancedError.isHandled = true;
  return enhancedError;
}