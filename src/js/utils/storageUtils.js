import { supabase } from '../lib/supabase';

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
  const fileName = createStorageFileName(file.name);
  const filePath = getStoragePath(bucket, fileName);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      ...options
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return { fileName, filePath, publicUrl };
}