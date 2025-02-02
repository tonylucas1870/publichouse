import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { calculateFileHash } from '../utils/mediaUtils.js';

export class MediaProofService {
  /**
   * Creates a proof for an uploaded media file
   * @param {File} file The media file
   * @param {Object} metadata Additional metadata about the file
   * @returns {Promise<{proofId: string, fileHash: string}>}
   */
  async createProof(file, metadata = {}) {
    try {
      // Calculate file hash
      const fileHash = await calculateFileHash(file);

      // Create proof
      const { data: { proof_id }, error } = await supabase.rpc(
        'create_media_proof',
        {
          p_file_hash: fileHash,
          p_metadata: {
            ...metadata,
            filename: file.name,
            type: file.type,
            size: file.size
          }
        }
      );

      if (error) throw error;

      return {
        proofId: proof_id,
        fileHash
      };
    } catch (error) {
      console.error('Error creating media proof:', error);
      throw handleSupabaseError(error, 'Failed to create media proof');
    }
  }

  /**
   * Verifies a media proof
   * @param {string} proofId The proof ID
   * @param {string} fileHash The file hash to verify
   * @returns {Promise<boolean>}
   */
  async verifyProof(proofId, fileHash) {
    try {
      const { data, error } = await supabase.rpc(
        'verify_media_proof',
        {
          p_proof_id: proofId,
          p_file_hash: fileHash
        }
      );

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error verifying media proof:', error);
      throw handleSupabaseError(error, 'Failed to verify media proof');
    }
  }

  /**
   * Gets proof data for verification
   * @param {string} proofId The proof ID
   * @returns {Promise<Object>}
   */
  async getProof(proofId) {
    try {
      const { data, error } = await supabase.rpc(
        'get_media_proof',
        { p_proof_id: proofId }
      );

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting media proof:', error);
      throw handleSupabaseError(error, 'Failed to get media proof');
    }
  }
}