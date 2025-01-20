import { uploadFile } from '../utils/storageUtils.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { validateMedia } from '../utils/imageUtils.js';

export class ContentsImageService {
  static async uploadImage(file) {
    try {
      // Validate file
      const error = validateMedia(file);
      if (error) {
        throw new Error(error);
      }

      const { publicUrl } = await uploadFile('contents', file);
      return publicUrl;
    } catch (error) {
      console.error('ContentsImageService error:', error);
      throw handleSupabaseError(error, 'Failed to upload item media');
    }
  }
}