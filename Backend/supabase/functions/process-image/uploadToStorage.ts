// uploadToStorage.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('❌ Missing required Supabase configuration (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Uploads an image from a remote URL into Supabase Storage
 * @param imageUrl URL of the image (from Replicate or other source)
 * @returns Public URL of the uploaded image
 */
export async function uploadToStorage(imageUrl: string): Promise<string> {
  try {
    if (!imageUrl) {
      throw new Error('❌ No image URL provided');
    }

    console.log('⬇️ Downloading image from:', imageUrl);

    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`❌ Failed to download image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    if (!uint8Array || uint8Array.length === 0) {
      throw new Error('❌ Downloaded image is empty');
    }

    console.log(`✅ Downloaded image size: ${uint8Array.length} bytes`);

    // Generate unique file name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileName = `processed/${timestamp}-${randomString}.jpg`;

    console.log('⬆️ Uploading to Supabase Storage as:', fileName);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('processed-images')
      .upload(fileName, uint8Array, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('❌ Upload error details:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('processed-images')
      .getPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error('❌ Failed to generate public URL');
    }

    console.log('✅ Successfully uploaded. Public URL:', publicUrl);
    return publicUrl;

  } catch (error) {
    console.error('❌ Error in uploadToStorage:', error);
    throw new Error(`Storage upload failed: ${(error as Error).message}`);
  }
}
