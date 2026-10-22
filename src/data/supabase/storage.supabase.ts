import { supabase } from './client';
import type { FileStorage } from '../storage';

export const supabaseFileStorage: FileStorage = {
  async upload(bucket, path, data, contentType) {
    const { error } = await supabase.storage.from(bucket).upload(path, data, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) return { url: null, error: { message: error.message } };
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: publicUrlData?.publicUrl || null, error: null };
  },
};
