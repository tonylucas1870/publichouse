import { uploadFile } from '../utils/storageUtils.js';
import { handleSupabaseError } from '../utils/errorUtils.js';

export class ContentsImageService {
  static async uploadImage(file) {
    try {
      const { publicUrl } = await uploadFile('contents', file);
      return publicUrl;
    } catch (error) {
      console.error('ContentsImageService error:', error);
      throw handleSupabaseError(error, 'Failed to upload item image');
    }
  }
}