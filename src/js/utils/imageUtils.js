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

export function validateMedia(file, { maxSize = 50 * 1024 * 1024, types = [
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/webm',
  'video/quicktime'  // For .mov files
] } = {}) {
  if (!file) {
    return 'Please select an image or video';
  }

  if (!types.includes(file.type)) {
    return 'Please select a valid image or video file (JPEG, PNG, MP4, WebM, MOV)';
  }

  if (file.size > maxSize) {
    return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
  }

  return null;
}

export function getStorageFilePath(fileName, prefix = '') {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const ext = fileName.split('.').pop();
  return `${prefix}${timestamp}-${randomString}.${ext}`;
}