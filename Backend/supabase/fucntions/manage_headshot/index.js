import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Replicate from "https://esm.sh/replicate@0.25.2"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { validateSchema, schemas } from "../_shared/validation.js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Rate limiting
const rateLimit = new Map()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS = 10 // Max requests per minute

const validateRequest = (req) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW
  
  // Clean up old entries
  for (const [key, { timestamp }] of rateLimit.entries()) {
    if (timestamp < windowStart) rateLimit.delete(key)
  }
  
  const requestCount = Array.from(rateLimit.values())
    .filter(entry => entry.timestamp > windowStart && entry.ip === ip)
    .length
    
  if (requestCount >= MAX_REQUESTS) {
    return { rateLimited: true }
  }
  
  rateLimit.set(now, { ip, timestamp: now })
  return { rateLimited: false }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // Rate limiting check
  const { rateLimited } = validateRequest(req)
  if (rateLimited) {
    return new Response(
      JSON.stringify({ error: "Too many requests" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  try {
    // Input validation
    const body = await req.json().catch(() => ({}))
    const validation = validateSchema(schemas.headshotGeneration, body)
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          error: "Validation failed",
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { userId, image, poseId, lightingId, outfitId, cameraZoomId, backgroundId, bodyTypeId, ageId, genderId } = body
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY")
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!REPLICATE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables")
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const replicate = new Replicate({ auth: REPLICATE_API_KEY })

    // --- Step 1: Check user credits ---
    const { data: creditsConfig } = await supabase
      .from("credits_config")
      .select("config_key, config_value")
      .in("config_key", ["credits_per_generation"])
    
    const creditsPerGeneration = creditsConfig?.find(c => c.config_key === "credits_per_generation")?.config_value || 2

    const { data: userCredits, error: userCreditsError } = await supabase
      .from("user_credits")
      .select("id, current_credits, total_credits_used")
      .eq("user_id", userId)
      .single()

    if (userCreditsError) throw userCreditsError
    if (!userCredits) throw new Error("User credits not found")

    if (userCredits.current_credits < creditsPerGeneration) {
      return new Response(JSON.stringify({ error: "Insufficient credits", success: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 402,
      })
    }

    // --- Step 2: Deduct credits ---
    const { error: updateError } = await supabase
      .from("user_credits")
      .update({
        current_credits: userCredits.current_credits - creditsPerGeneration,
        total_credits_used: userCredits.total_credits_used + creditsPerGeneration,
      })
      .eq("user_id", userId)

    if (updateError) throw updateError

    // --- Step 3: Fetch mappings (like generate-headshot) ---
    const allIds = [poseId, lightingId, outfitId, cameraZoomId, backgroundId, bodyTypeId, ageId, genderId].filter(id => id)
    const allCategories = ["pose", "lighting", "outfit", "cameraZoom", "background", "bodyType", "age", "gender"]

    const { data: mappings, error: mappingsError } = await supabase
      .from("prompt_mappings")
      .select("category, mapping_id, prompt_value")
      .in("mapping_id", allIds)
      .in("category", allCategories)

    if (mappingsError) throw new Error("Failed to fetch prompt mappings")

    const getMapping = (category, id) => mappings?.find(m => m.category === category && m.mapping_id === id)?.prompt_value

    // --- Step 4: Build prompt ---
    const isAllDefaults =
      poseId === 1 && lightingId === 1 && outfitId === 1 &&
      cameraZoomId === 1 && backgroundId === 1 && bodyTypeId === 2 &&
      ageId === 2 && genderId === 1

    let finalPrompt
    if (isAllDefaults) {
      finalPrompt = "Professional headshot, zoomed out, body tilted from side but looking from camera, outside daytime lighting, modern well-fitted charcoal grey business suit, crisp white dress shirt, neutral out-of-focus background, photorealistic, high resolution. For face, use the image provided and it should be exactly the same face. For the body: 70kg, slightly chubby, 30 years old male."
    } else {
      const cameraZoomMapping = getMapping("cameraZoom", cameraZoomId) || "zoomed out"
      const poseMapping = getMapping("pose", poseId) || "body tilted from side but looking from camera"
      const lightingMapping = getMapping("lighting", lightingId) || "outside daytime lighting"
      const outfitMapping = getMapping("outfit", outfitId) || "modern well-fitted charcoal grey business suit, crisp white dress shirt"
      const backgroundMapping = getMapping("background", backgroundId) || "neutral out-of-focus background"
      const bodyTypeMapping = getMapping("bodyType", bodyTypeId) || "70kg, slightly chubby"
      const ageMapping = getMapping("age", ageId) || "30 years old"
      const genderMapping = getMapping("gender", genderId) || "male"

      const basePrompt = "Professional headshot, photorealistic, high resolution. For face, use the image provided and it should be exactly the same face."
      const dynamicElements = `${cameraZoomMapping}, ${poseMapping}, ${lightingMapping}, ${outfitMapping}, ${backgroundMapping}, For the body: ${bodyTypeMapping}, ${ageMapping} ${genderMapping}.`
      finalPrompt = `${basePrompt} ${dynamicElements}`
    }

    // --- Step 5: Call Replicate ---
    const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
      input: { input_image: image, prompt: finalPrompt, output_format: "jpg" }
    })

    const imageUrl = Array.isArray(output) ? output[0] : output

    return new Response(
      JSON.stringify({
        imageUrl,
        success: true,
        creditsLeft: userCredits.current_credits - creditsPerGeneration
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error) {
    console.error("Error:", error.message)
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error" 
      }),
      { 
        status: error.status || 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    )
  }
})
