-- 20250824_create_prompt_mappings_with_defaults.sql
-- Migration: Create prompt_mappings table with secure parameter handling and defaults

-- Create prompt mapping table
CREATE TABLE public.prompt_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  mapping_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  prompt_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prompt_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read mappings (safe since it's config data only)
CREATE POLICY "Prompt mappings are viewable by everyone" 
ON public.prompt_mappings 
FOR SELECT 
USING (true);

-- Prevent duplicates: same category + mapping_id
ALTER TABLE public.prompt_mappings 
ADD CONSTRAINT unique_category_mapping UNIQUE (category, mapping_id);

-- Prevent duplicates: same category + label
ALTER TABLE public.prompt_mappings 
ADD CONSTRAINT unique_category_label UNIQUE (category, label);

-- Auto-update `updated_at` on row changes
CREATE OR REPLACE FUNCTION update_prompt_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_prompt_mappings_updated_at
BEFORE UPDATE ON public.prompt_mappings
FOR EACH ROW
EXECUTE PROCEDURE update_prompt_mappings_updated_at();

-- ===========================
-- Default Values
-- ===========================

-- Poses
INSERT INTO public.prompt_mappings (category, mapping_id, label, prompt_value) VALUES
('pose', 1, 'Professional Standing', 'standing straight, confident posture'),
('pose', 2, 'Sitting Confidently', 'sitting confidently in chair'),
('pose', 3, 'Casual Lean', 'leaning casually against surface'),
('pose', 4, 'Arms Crossed', 'arms crossed professionally');

-- Lighting
INSERT INTO public.prompt_mappings (category, mapping_id, label, prompt_value) VALUES
('lighting', 1, 'Studio Lighting', 'professional studio lighting, soft shadows'),
('lighting', 2, 'Natural Light', 'natural daylight, soft illumination'),
('lighting', 3, 'Golden Hour', 'warm golden hour lighting'),
('lighting', 4, 'Office Environment', 'bright office lighting, clean environment');

-- Outfits
INSERT INTO public.prompt_mappings (category, mapping_id, label, prompt_value) VALUES
('outfit', 1, 'Business Suit', 'modern well-fitted charcoal grey business suit, crisp white dress shirt'),
('outfit', 2, 'Casual Business', 'smart casual attire, button-down shirt'),
('outfit', 3, 'Creative Professional', 'stylish blazer, modern professional look'),
('outfit', 4, 'Tech Professional', 'modern casual professional attire');

-- Environments (backgrounds)
INSERT INTO public.prompt_mappings (category, mapping_id, label, prompt_value) VALUES
('environment', 1, 'Office Background', 'modern corporate office setting, clean background'),
('environment', 2, 'Nature Background', 'outdoor nature scenery, greenery, blurred background'),
('environment', 3, 'Urban Street', 'city street background, professional urban vibe'),
('environment', 4, 'Studio Backdrop', 'neutral professional studio backdrop, plain background');

-- Index for fast lookups
CREATE INDEX idx_prompt_mappings_category_id 
ON public.prompt_mappings(category, mapping_id);
