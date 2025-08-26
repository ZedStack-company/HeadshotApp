import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { uploadToStorage } from './uploadToStorage.ts';

type ProcessRequest = {
  image: string; // Base64 encoded image
  prompt?: string; // optional custom prompt
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Replicate API configuration
const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
if (!REPLICATE_API_TOKEN) {
  console.error('REPLICATE_API_TOKEN is not set');
}

const REPLICATE_MODEL = "black-forest-labs/flux-kontext-pro";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestData: ProcessRequest = await req.json();

    if (!requestData.image) {
      return new Response(
        JSON.stringify({ error: 'Missing image in request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pick prompt (use default if none provided)
    const prompt =
      requestData.prompt ??
      "Ultra-realistic professional corporate headshot of a confident human, chest-up, wearing a tailored business suit and tie, neutral studio background, even soft lighting, sharp focus on the face, natural skin tones, DSLR-quality, high resolution, professional LinkedIn style portrait";

    console.log("Using prompt:", prompt);

    // 1. Upload base64 image to Supabase → get URL
    const imageUrl = await uploadToStorage(requestData.image);
    console.log("Uploaded image URL:", imageUrl);

    // 2. Call Replicate with image URL + prompt
    const output = await callReplicateAPI(imageUrl, prompt);

    if (!output || output.length === 0) {
      throw new Error("No output received from Replicate");
    }

    // 3. Upload the processed image (returned URL) to Supabase storage
    const processedImageUrl = await uploadToStorage(output[0]);

    return new Response(
      JSON.stringify({
        success: true,
        prompt,
        inputImage: imageUrl,
        imageUrl: processedImageUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error processing image:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function callReplicateAPI(
  imageUrl: string,
  prompt: string
): Promise<string[]> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API token is not configured");
  }

  const start = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      "Prefer": "wait", // wait until complete
    },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: imageUrl,
        output_format: "jpg"
      }
    }),
  });

  if (!start.ok) {
    throw new Error(`Replicate API error: ${await start.text()}`);
  }

  const result = await start.json();
  console.log("Replicate response:", result);

  return result.output ? [result.output] : [];
}
