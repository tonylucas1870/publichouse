import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { uploadFile } from '../utils/storageUtils.js';
import { getCurrentDate } from '../utils/dateUtils.js';

export class FindingsService {
  async getFindings(changeoverId) {
    try {
      console.debug('FindingsService: Getting findings with content items', { changeoverId });

      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      
      console.debug('FindingsService: Current user', { userId: user?.id });

      console.debug('FindingsService: Verifying changeover access');
      const { data: changeover, error: changeoverError } = await supabase
        .from('changeovers')
        .select(`
          id,
          property:properties (
            id,
            created_by,
            name
          )
        `)
        .eq('id', changeoverId)
        .single();

      if (changeoverError) throw changeoverError;
      console.debug('FindingsService: Changeover data', {
        shareToken: changeover.share_token,
        propertyOwnerId: changeover.property?.created_by,
        userId: user?.id
      });
      
      // Check access
      if (!user || user.id !== changeover.property?.created_by) {
        console.debug('FindingsService: Access denied', {
          isAuthenticated: !!user,
          isOwner: user?.id === changeover.property?.created_by
        });
        throw new Error('Access denied');
      }

      console.debug('FindingsService: Fetching findings with content items');
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
        .eq('changeover_id', changeoverId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.debug('FindingsService: Got findings', {
        count: data?.length,
        firstFinding: data?.[0],
        hasContentItem: data?.[0]?.content_item !== undefined
      });

      return data || [];
    } catch (error) {
      console.error('FindingsService: Error getting findings', error);
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

  async add({ description, location, contentItem, images, changeoverId }) {
    try {
      console.debug('FindingsService: Adding finding with content item', {
        hasContentItem: !!contentItem,
        contentItem
      });

      // Verify changeover access first
      const { data: changeover, error: changeoverError } = await supabase
        .from('changeovers')
        .select(`
          id,
          property:properties (
            id,
            created_by
          )
        `)
        .eq('id', changeoverId)
        .single();

      if (changeoverError) throw changeoverError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== changeover.property.created_by) {
        throw new Error('Access denied');
      }

      // Upload all images
      const uploadedUrls = await Promise.all(
        images.map(image => uploadFile('findings', image))
      );

      console.debug('FindingsService: Creating finding record', {
        description,
        location,
        contentItem,
        imageCount: uploadedUrls.length
      });

      const { data, error } = await supabase
        .from('findings')
        .insert({
          description,
          location,
          content_item: contentItem,
          images: uploadedUrls.map(url => url.publicUrl),
          changeover_id: changeoverId,
          status: 'pending',
          date_found: getCurrentDate(),
          notes: []
        })
        .select()
        .single();

      if (error) throw error;
      
      console.debug('FindingsService: Created finding', {
        id: data.id,
        hasContentItem: !!data.content_item
      });

      return data;
    } catch (error) {
      console.error('FindingsService: Error adding finding', error);
      throw handleSupabaseError(error, 'Failed to add finding');
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