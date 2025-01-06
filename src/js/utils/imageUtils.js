export function createImagePreview(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Invalid image file'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export function validateImage(file, { maxSize = 5 * 1024 * 1024, types = ['image/jpeg', 'image/png'] } = {}) {
  if (!file) {
    return 'Please select an image';
  }

  if (!types.includes(file.type)) {
    return 'Please select a valid image file (JPEG or PNG)';
  }

  if (file.size > maxSize) {
    return `Image size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
  }

  return null;
}

export function getStorageFilePath(fileName, prefix = '') {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const ext = fileName.split('.').pop();
  return `${prefix}${timestamp}-${randomString}.${ext}`;
}