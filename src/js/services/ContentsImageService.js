import { uploadFile } from '../utils/storageUtils.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { validateMedia } from '../utils/imageUtils.js';
import { MediaProofService } from './MediaProofService.js';

const mediaProofService = new MediaProofService();

export class ContentsImageService {
  static async uploadImage(file) {
    try {
      // Validate file
      const error = validateMedia(file);
      if (error) {
        throw new Error(error);
      }

      // Create proof before upload
      const { proofId, fileHash } = await mediaProofService.createProof(file, {
        usage: 'contents',
        uploadedAt: new Date().toISOString()
      });

      const { publicUrl } = await uploadFile('contents', file);
      
      // Return URL and proof data
      return {
        url: publicUrl,
        proofId,
        fileHash
      };
    } catch (error) {
      console.error('ContentsImageService error:', error);
      throw handleSupabaseError(error, 'Failed to upload item media');
    }
  }

  static async verifyUpload(url, proofId, fileHash) {
    try {
      const isValid = await mediaProofService.verifyProof(proofId, fileHash);
      if (!isValid) {
        throw new Error('Media proof verification failed');
      }
      return true;
    } catch (error) {
      console.error('ContentsImageService error:', error);
      throw handleSupabaseError(error, 'Failed to verify media upload');
    }
  }
}