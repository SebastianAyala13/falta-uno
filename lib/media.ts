import { supabase, supabaseConfigurado } from '@/lib/supabase';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string,string> = {
  'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif',
};

/** Store a selected local photo once; only public image URLs go into shared rows. */
export async function subirImagen(uri: string | null | undefined, usuarioId: string): Promise<string | null> {
  if (!uri) return null;
  if (!supabaseConfigurado || /^https:\/\//i.test(uri)) return uri;
  const {data,error:sessionError} = await supabase.auth.getUser();
  if (sessionError || data.user?.id !== usuarioId) throw new Error('Necesitás iniciar sesión para subir fotos.');
  const response = await fetch(uri);
  if (!response.ok) throw new Error('No pudimos leer la foto. Elegila otra vez.');
  const blob = await response.blob();
  const extension = uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  const mime = blob.type || Object.entries(MIME_EXT).find(([,ext])=>ext===extension || (ext==='jpg' && extension==='jpeg'))?.[0] || '';
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error('Elegí una foto JPG, PNG, WebP o HEIC.');
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('La foto debe pesar hasta 5 MB. Elegí una más pequeña.');
  const bytes = await blob.arrayBuffer();
  const path = `${usuarioId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.${ext}`;
  const {error} = await supabase.storage.from('media').upload(path,bytes,{contentType:mime,upsert:false});
  if (error) throw new Error('No pudimos subir la foto. Reintentá.');
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
