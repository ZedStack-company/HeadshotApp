import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { uploadToStorage } from './uploadToStorage.ts';

type ProcessRequest = {
  image: string; // Base64 encoded image
  gender: string;
  style: string;
  background: string;
  suit: string;
  lighting: string;
  faceBounds?: any;
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

const REPLICATE_MODEL =
  '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b'; // SDXL version ID only

const validateRequest = (
  requestData: Partial<ProcessRequest>
): { valid: boolean; error?: string } => {
  const requiredFields: (keyof ProcessRequest)[] = [
    'image',
    'gender',
    'style',
    'background',
    'suit',
    'lighting',
  ];
  const missingFields = requiredFields.filter((field) => !requestData[field]);

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`,
    };
  }

  if (!requestData.image?.startsWith('data:image/')) {
    return {
      valid: false,
      error:
        'Invalid image format. Please provide a valid base64 encoded image.',
    };
  }

  return { valid: true };
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let requestData: ProcessRequest;

    try {
      requestData = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request
    const { valid, error } = validateRequest(requestData);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: error || 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt
    const prompt ="A professional corporate headshot of a smiling person including torso, wearing a business suit, neutral background, studio lighting, ultra high resolution, sharp focus, professional photography";
    //   (requestData as any).prompt?.toString()?.slice(0, 800) ??
    //   generatePrompt(
    //     requestData.gender,
    //     requestData.style,
    //     requestData.background,
    //     requestData.suit,
    //     requestData.lighting
    //   );

    console.log('Processing image with prompt:', prompt);

    // Call Replicate API
    const output = await callReplicateAPI(requestData.image, prompt);

    if (!output || output.length === 0) {
      throw new Error('No output received from image processing service');
    }

    // Upload result to Supabase
    const processedImageUrl = await uploadToStorage(output[0]);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: processedImageUrl,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing image:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'Failed to process image',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

function generatePrompt(
  gender: string,
  style: string,
  background: string,
  suit: string,
  lighting: string
): string {
  const styleMap: Record<string, string> = {
    professional: 'professional corporate style',
    casual: 'smart casual style',
    formal: 'formal elegant style',
  };

  const bgMap: Record<string, string> = {
    office: 'modern office background with soft blur',
    studio: 'clean studio backdrop',
    outdoor: 'outdoor background with soft bokeh',
  };

  const suitMap: Record<string, string> = {
    suit1: 'business suit with dress shirt and tie',
    suit2: 'tailored blazer over a plain shirt',
    suit3: 'formal suit with crisp shirt',
    suit: 'business suit',
  };

  const lightMap: Record<string, string> = {
    natural: 'soft natural daylight',
    studio: 'professional studio lighting with soft key and fill',
    dramatic: 'dramatic high-contrast lighting',
  };

  const g = gender || 'person';
  const s = styleMap[style] || style || 'professional style';
  const bg = bgMap[background] || background || 'studio background';
  const outfit = suitMap[suit] || suit || 'business attire';
  const light = lightMap[lighting] || lighting || 'studio lighting';

  return [
    `A professional headshot photo of a ${g}`,
    s,
    'tight composition head-and-shoulders portrait, chest-up, centered subject, eye-level camera angle',
    `wearing ${outfit}`,
    `in a ${bg}`,
    `lit with ${light}`,
    'no full body, no hands visible, no text, no watermark',
    'sharp focus, high detail, realistic skin texture, professional photography, 85mm lens, shallow depth of field',
  ].join(', ');
}

async function callReplicateAPI(
  imageBase64: string,
  prompt: string
): Promise<string[]> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('Replicate API token is not configured');
  }

  // Start prediction
  const start = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: REPLICATE_MODEL,
      input: {
        prompt,
        image: imageBase64,
        negative_prompt:
          'full body, hands, fingers, cropped head, profile view, side view, low quality, blurry, distorted face, extra limbs, text, watermark',
        num_outputs: 1,
        num_inference_steps: 40,
        guidance_scale: 8.5,
        width: 1024,
        height: 1024,
      },
    }),
  });

  if (!start.ok) {
    throw new Error(`Replicate start error: ${await start.text()}`);
  }

  const prediction = await start.json();

  // Poll until done
  let attempts = 0;
  const maxAttempts = 60; // up to ~60s
  let status = prediction;

  while (
    status.status !== 'succeeded' &&
    status.status !== 'failed' &&
    attempts < maxAttempts
  ) {
    await new Promise((r) => setTimeout(r, 2000)); // wait 2s
    const res = await fetch(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      {
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
        },
      }
    );
    status = await res.json();
    attempts++;
  }

  if (status.status === 'failed') {
    throw new Error('Replicate image generation failed');
  }
  if (status.status !== 'succeeded') {
    throw new Error('Replicate image processing timed out');
  }

  return status.output;
}
