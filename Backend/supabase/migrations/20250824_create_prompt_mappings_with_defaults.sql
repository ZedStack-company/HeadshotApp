-- 20250824_create_prompt_mappings_with_defaults.sql

-- Create prompt mapping table for secure parameter handling
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

-- Create policy for public read access (no auth required since this is configuration data)
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

-- Trigger to auto-update updated_at on row updates
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

-- Insert default mappings for poses
INSERT INTO public.prompt_mappings (category, mapping_id, label, prompt_value) VALUES
('pose', 1, 'Professional Standing', 'standing straight, confident posture'),
('pose', 2, 'Sitting Confidently', 'sitting confidently in chair'),
('pose', 3, 'Casual Lean', 'leaning casually against surface'),
('pose', 4, 'Arms Crossed', 'arms crossed professionally');

-- Insert default mappings for lighting
INSERT INTO public.prompt_mappings (category, mapping_id, label, prompt_value) VALUES
('lighting', 1, 'Studio Lighting', 'professional studio lighting, soft shadows'),
('lighting', 2, 'Natural Light', 'natural daylight, soft illumination'),
('lighting', 3, 'Golden Hour', 'warm golden hour lighting'),
('lighting', 4, 'Office Environment', 'bright office lighting, clean environment');

-- Insert default mappings for outfits
INSERT INTO public.prompt_mappings (category, mapping_id, label, prompt_value) VALUES
('outfit', 1, 'Business Suit', 'modern well-fitted charcoal grey business suit, crisp white dress shirt'),
('outfit', 2, 'Casual Business', 'smart casual attire, button-down shirt'),
('outfit', 3, 'Creative Professional', 'stylish blazer, modern professional look'),
('outfit', 4, 'Tech Professional', 'modern casual professional attire');

-- Create index for faster lookups
CREATE INDEX idx_prompt_mappings_category_id 
ON public.prompt_mappings(category, mapping_id);
