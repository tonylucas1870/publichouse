import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { uploadFile } from '../utils/storageUtils.js';
import { getCurrentDate } from '../utils/dateUtils.js';

export class FindingsService {
  async getFindings(changeoverId) {
    try {
      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();

      // Verify changeover exists and get property info
      const { data: changeover, error: changeoverError } = await supabase 
        .from('changeovers')
        .select(`
          id,
          share_token,
          property:properties (
            id,
            created_by,
            name
          )
        `)
        .eq('id', changeoverId)
        .single();

      if (changeoverError) throw changeoverError;

      // Check access - allow if shared or owner
      if (!changeover.share_token && (!user || user.id !== changeover.property?.created_by)) {
        throw new Error('Access denied');
      }

      const { data, error } = await supabase
        .from('findings').select(`
          id,
          description,
          location,
          images,
          date_found,
          status,
          notes,
          content_item,
          changeover:changeovers (
            id,
            property:properties (
              id,
              name
            )
          )
        `)
        .eq('changeover_id', changeoverId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('FindingsService: Error getting findings', error);
      throw handleSupabaseError(error, 'Failed to load findings');
    }
  }

  async getFinding(findingId) {
    try {
      const { data, error } = await supabase
        .from('findings')
        .select(`
          id,
          description,
          location,
          images,
          date_found,
          status,
          notes,
          content_item,
          changeover:changeovers (
            id,
            property:properties (
              id,
              name
            )
          )
        `)
        .eq('id', findingId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('FindingsService: Error getting finding', error);
      throw handleSupabaseError(error, 'Failed to load finding');
    }
  }

  async getFindingsByContentItem(contentItemName) {
    try {
      console.debug('FindingsService: Getting findings by content item', { contentItemName });
      const { data, error } = await supabase
        .from('findings')
        .select(`
          id,
          description,
          location,
          images,
          date_found,
          status,
          notes,
          content_item,
          changeover:changeovers (
            id,
            property:properties (
              id,
              name
            )
          )
        `)
        .eq('content_item->>name', contentItemName)
        .order('date_found', { ascending: false });

      if (error) throw error;
      console.debug('FindingsService: Got findings', {
        count: data?.length,
        findings: data?.map(f => ({
          id: f.id,
          description: f.description,
          hasImages: !!f.images,
          imageCount: f.images?.length,
          contentItem: f.content_item
        }))
      });
      return data || [];
    } catch (error) {
      console.error('FindingsService: Error getting findings by content item', error);
      throw handleSupabaseError(error, 'Failed to load findings');
    }
  }

  async getPendingFindings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return []; // Return empty array if not authenticated

      const { data, error } = await supabase
        .from('findings')
        .select(`
          id,
          description,
          location,
          images,
          date_found,
          status,
          notes,
          content_item,
          changeover:changeovers (
            id,
            property:properties (
              id,
              name,
              created_by
            )
          )
        `)
        .eq('status', 'pending');

      if (error) throw error;

      // Filter findings to only show those where user is owner
      return (data || []).filter(finding => {
        const property = finding.changeover?.property;
        if (!property) return false;

        return property.created_by === user.id;
      });
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load pending findings');
    }
  }

  async add({ description, location, content_item, images, changeoverId }) {
    try {
      // Verify changeover access first
      const { data: changeover, error: changeoverError } = await supabase 
        .from('changeovers')
        .select('id, share_token, property_id')
        .eq('id', changeoverId)
        .single();

      if (changeoverError) throw changeoverError;
      if (!changeover) throw new Error('Changeover not found');

      // Upload all images
      const uploadedUrls = await Promise.all(
        images.map(image => uploadFile('findings', image))
      );

      const { data, error } = await supabase
        .from('findings')
        .insert({
          description,
          location,
          content_item,
          changeover_id: changeoverId,
          status: 'pending',
          images: uploadedUrls.map(({ publicUrl, uploadedAt }) => ({
            url: publicUrl,
            uploadedAt
          })),
          date_found: getCurrentDate(),
          notes: []
        })
        .select()
        .single();

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('FindingsService: Error adding finding', error);
      throw handleSupabaseError(error, 'Failed to add finding');
    }
  }

  async updateImages(findingId, images) {
    try {
      const { error } = await supabase
        .from('findings')
        .update({ images })
        .eq('id', findingId);

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update finding images');
    }
  }

  async updateStatus(findingId, status) {
    try {
      const { error } = await supabase
        .from('findings')
        .update({ status })
        .eq('id', findingId);

      if (error) throw error;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to update finding status');
    }
  }

  async addNote(findingId, text) {
    try {
      const { data: finding, error: findingError } = await supabase
        .from('findings')
        .select('notes')
        .eq('id', findingId)
        .single();

      if (findingError) throw findingError;

      const { data: { user } } = await supabase.auth.getUser();
      const newNote = {
        text,
        user_email: user.email,
        created_at: new Date().toISOString()
      };

      const notes = [...(finding.notes || []), newNote];

      const { error: updateError } = await supabase
        .from('findings')
        .update({ notes })
        .eq('id', findingId);

      if (updateError) throw updateError;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to add note');
    }
  }
}