import { supabase } from '../lib/supabase.js';

// Storage path and file name utilities
export function createStorageFileName(originalName) {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop();
  return `${timestamp}-${randomString}.${ext}`;
}

export function getStoragePath(bucket, fileName) {
  return `${bucket}/${fileName}`;
}

// Storage operations
export async function uploadFile(bucket, file, options = {}) {
  try {
    console.debug('Uploading file:', { bucket, fileName: file.name, fileType: file.type });

    const fileName = createStorageFileName(file.name);
    const filePath = getStoragePath(bucket, fileName);
    const uploadedAt = new Date().toISOString();

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        ...options
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.debug('File uploaded successfully:', { filePath, publicUrl });

    return { fileName, filePath, publicUrl, uploadedAt };
  } catch (error) {
    console.error('Error in uploadFile:', error);
    throw new Error('Failed to upload file: ' + error.message);
  }
}