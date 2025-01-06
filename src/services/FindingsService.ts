import { supabase } from '../lib/supabase';

export class FindingsService {
  async getAll() {
    const { data, error } = await supabase
      .from('findings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async add({ description, location, image }: { description: string; location: string; image: File }) {
    // 1. Upload image to Supabase Storage
    const fileExt = image.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `findings/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('findings')
      .upload(filePath, image);

    if (uploadError) throw uploadError;

    // 2. Get public URL for the uploaded image
    const { data: { publicUrl } } = supabase.storage
      .from('findings')
      .getPublicUrl(filePath);

    // 3. Create finding record
    const { data, error } = await supabase
      .from('findings')
      .insert({
        description,
        location,
        image_url: publicUrl,
        user_id: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}