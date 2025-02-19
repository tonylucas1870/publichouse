import { supabase } from '../lib/supabase.js';
import { handleSupabaseError } from '../utils/errorUtils.js';
import { uploadFile } from '../utils/storageUtils.js';
import { getCurrentDate } from '../utils/dateUtils.js';

export class FindingsService {
  async getFindings(changeoverId) {
    try {
      console.debug('FindingsService: Getting findings', { changeoverId });

      // Check if this is a property ID instead of a changeover ID
      const { data: changeovers, error: changeoverError } = await supabase
        .from('changeovers')
        .select('id')
        .eq('property_id', changeoverId);

      if (!changeoverError && changeovers?.length > 0) {
        // If we got changeovers, this was a property ID
        const changeoverIds = changeovers.map(c => c.id);
        console.debug('FindingsService: Found changeovers for property', { 
          count: changeoverIds.length,
          ids: changeoverIds 
        });

        const { data: findings, error: findingsError } = await supabase
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
          .in('changeover_id', changeoverIds)
          .order('date_found', { ascending: false });

        if (findingsError) throw findingsError;
        return findings || [];
      }

      // Get findings for the changeover
      const { data: findings, error: findingsError } = await supabase
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
        .order('date_found', { ascending: false });


      if (findingsError) throw findingsError;
      
      return findings || [];
    } catch (error) {
      console.error('FindingsService: Error getting findings', error);
      console.debug('FindingsService: Error details', {
        error,
        changeoverId,
        message: error.message,
        details: error.details
      });
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

  async getOpenFindings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.debug('FindingsService: No authenticated user');
        return []; 
      }

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
        .in('status', ['open', 'blocked'])
        .order('date_found', { ascending: false });

      if (error) {
        console.error('FindingsService: Error fetching open findings:', error);
        throw error;
      }

      // Filter findings to only show those where user is owner
      const filteredFindings = (data || []).filter(finding => {
        const property = finding.changeover?.property;
        if (!property) return false;

        return property.created_by === user.id;
      });
      
      console.debug('FindingsService: Filtered findings', {
        total: data?.length || 0,
        filtered: filteredFindings.length
      });
      
      return filteredFindings;
    } catch (error) {
      console.error('FindingsService: Error in getOpenFindings:', error);
      throw handleSupabaseError(error, 'Failed to load pending findings');
    }
  }

  async add({ description, location, content_item, images, changeoverId }) {
    try {
      console.debug('FindingsService: Adding finding', {
        description,
        location,
        hasContentItem: !!content_item,
        imageCount: images.length,
        changeoverId
      });

      // Verify changeover access first
      const { data: changeover, error: changeoverError } = await supabase
        .from('changeovers')
        .select('id, share_token, property_id')
        .eq('id', changeoverId)
        .single();

      console.debug('FindingsService: Changeover check result', {
        hasChangeover: !!changeover,
        hasShareToken: !!changeover?.share_token,
        error: changeoverError
      });

      if (changeoverError) throw changeoverError;
      if (!changeover) throw new Error('Changeover not found');

      // Get anonymous user ID if available
      let anonymousUserId = null;
      const anonymousId = localStorage.getItem('anonymousId'); 
      
      console.debug('FindingsService: Anonymous user check', {
        hasAnonymousId: !!anonymousId,
        anonymousId
      });

      if (anonymousId) {
        const { data: users, error: userError } = await supabase
          .from('anonymous_users')
          .select('id')
          .eq('anonymous_id', anonymousId);

        if (userError) {
          console.error('FindingsService: Error looking up anonymous user', userError);
        } else if (users && users.length > 0) {
          anonymousUserId = users[0].id;
        }
      }

      console.debug('FindingsService: Anonymous user lookup result', {
        hasAnonymousUserId: !!anonymousUserId,
        anonymousUserId
      });

      // Upload all images
      const uploadedUrls = await Promise.all(
        images.map(image => uploadFile('findings', image))
      );

      console.debug('FindingsService: Images uploaded', {
        uploadedCount: uploadedUrls.length,
        urls: uploadedUrls
      });

      const { data, error } = await supabase
        .from('findings')
        .insert({
          description,
          location,
          content_item,
          anonymous_user_id: anonymousUserId,
          changeover_id: changeoverId,
          status: 'open',
          images: uploadedUrls.map(result => result.publicUrl),
          date_found: getCurrentDate(),
          notes: []
        })
        .select()
        .single();

      console.debug('FindingsService: Finding insert result', {
        success: !!data && !error,
        error,
        findingId: data?.id
      });

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('FindingsService: Error adding finding', error);
      console.debug('FindingsService: Full error details', {
        error,
        changeoverId,
        hasAnonymousId: !!localStorage.getItem('anonymousId')
      });
      throw handleSupabaseError(error, 'Failed to add finding');
    }
  }

  async getFindingByShareToken(token) {
    try {
      console.debug('FindingsService: Getting finding by token', { token });

      if (!token) {
        throw new Error('Share token is required');
      }

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
          share_token,
          changeover:changeovers (
            id,
            property:properties (
              id,
              name
            )
          )
        `)
        .eq('share_token', token)
        .single();

      console.debug('FindingsService: Finding lookup result', {
        success: !!data && !error,
        error,
        findingId: data?.id
      });

      if (error) throw error;
      if (!data) throw new Error('Finding not found');

      return data;
    } catch (error) {
      console.error('FindingsService: Error getting finding by token', error);
      throw handleSupabaseError(error, 'Invalid or expired share token');
    }
  }

  async createShareLink(findingId) {
    try {
      const { data, error } = await supabase
        .rpc('create_finding_share_link', {
          finding_id: findingId
        });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to create share link');
    }
  }

  async getFindingByShareToken(token) {
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
        .eq('share_token', token)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'Failed to load finding');
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
      console.debug('FindingsService: Adding note', { findingId, text });

      // Get finding details including anonymous user info
      const { data: finding, error: findingError } = await supabase
        .from('findings')
        .select(`
          notes,
          changeover:changeovers (
            share_token
          ),
          anonymous_user_id
        `)
        .eq('id', findingId)
        .single();

      if (findingError) throw findingError;

      console.debug('FindingsService: Found finding', {
        hasNotes: !!finding.notes,
        noteCount: finding.notes?.length,
        hasShareToken: !!finding.changeover?.share_token,
        hasAnonymousId: !!finding.anonymous_user_id
      });

      // Get user info for the note
      const { data: { user } } = await supabase.auth.getUser();
      let noteAuthor;

      if (user) {
        // Authenticated user
        const { data: settings } = await supabase
          .from('user_settings')
          .select('display_name')
          .eq('user_id', user.id)
          .single();

        noteAuthor = {
          type: 'authenticated',
          id: user.id,
          display_name: settings?.display_name || user.email
        };
      } else if (finding.changeover?.share_token) {
        // Anonymous user with share token
        const anonymousId = localStorage.getItem('anonymousId');
        const anonymousName = localStorage.getItem('anonymousName');
        
        noteAuthor = {
          type: 'anonymous',
          id: anonymousId,
          display_name: anonymousName || 'Anonymous User'
        };
      } else {
        throw new Error('Not authorized to add notes');
      }

      console.debug('FindingsService: Creating note with author', { noteAuthor });

      // Create new note with enhanced metadata
      const newNote = {
        id: crypto.randomUUID(),
        text,
        created_at: new Date().toISOString(),
        author: noteAuthor
      };

      // Ensure notes is an array
      const currentNotes = Array.isArray(finding.notes) ? finding.notes : [];
      const notes = [...currentNotes, newNote];

      console.debug('FindingsService: Updating finding with new note', {
        noteCount: notes.length,
        latestNote: newNote
      });

      const { error: updateError } = await supabase
        .from('findings')
        .update({ notes })
        .eq('id', findingId);

      if (updateError) {
        console.error('FindingsService: Error updating notes', updateError);
        throw updateError;
      }

      console.debug('FindingsService: Note added successfully');
    } catch (error) {
      console.error('FindingsService: Error adding note', error);
      throw handleSupabaseError(error, 'Failed to add note');
    }
  }
}