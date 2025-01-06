export function validateForm(form, rules = {}) {
  let isValid = form.checkValidity();
  const errors = {};

  // Apply custom validation rules
  Object.entries(rules).forEach(([field, validate]) => {
    const input = form[field];
    if (input) {
      const error = validate(input.value);
      if (error) {
        isValid = false;
        errors[field] = error;
        input.classList.add('is-invalid');
        
        // Add or update error message
        let feedback = input.nextElementSibling;
        if (!feedback?.classList.contains('invalid-feedback')) {
          feedback = document.createElement('div');
          feedback.className = 'invalid-feedback';
          input.parentNode.insertBefore(feedback, input.nextSibling);
        }
        feedback.textContent = error;
      }
    }
  });

  form.classList.add('was-validated');
  return { isValid, errors };
}

export function resetForm(form) {
  form.reset();
  form.classList.remove('was-validated');
  
  // Reset custom validation states
  form.querySelectorAll('.is-invalid').forEach(input => {
    input.classList.remove('is-invalid');
  });
  
  form.querySelectorAll('.invalid-feedback').forEach(feedback => {
    feedback.remove();
  });
}