-- Create credits configuration table
CREATE TABLE public.credits_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value integer NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on credits_config
ALTER TABLE public.credits_config ENABLE ROW LEVEL SECURITY;

-- Policy: readable by everyone
CREATE POLICY "Credits config is viewable by everyone" 
ON public.credits_config 
FOR SELECT 
USING (true);

-- (Optional) Only service role can modify config
CREATE POLICY "Only service role can modify credits config"
ON public.credits_config
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

---------------------------------------------------------

-- Create user credits table
CREATE TABLE public.user_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_credits integer NOT NULL DEFAULT 0,
  daily_credit_reset_time timestamptz NOT NULL DEFAULT date_trunc('day', now() + interval '1 day'),
  last_credit_award_time timestamptz DEFAULT now(),
  total_credits_earned integer NOT NULL DEFAULT 0,
  total_credits_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on user_credits
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own credits
CREATE POLICY "Users can view their own credits"
ON public.user_credits
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can insert their own credits row
CREATE POLICY "Users can insert their own credits"
ON public.user_credits
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own credits
CREATE POLICY "Users can update their own credits"
ON public.user_credits
FOR UPDATE 
USING (auth.uid() = user_id);

---------------------------------------------------------

-- Insert default config values
INSERT INTO public.credits_config (config_key, config_value, description) VALUES
('credits_per_generation', 2, 'Credits required per image generation'),
('daily_free_credits', 4, 'Free credits given at daily reset'),
('hourly_credit_recovery', 1, 'Credits recovered per hour'),
('max_hourly_credits', 4, 'Maximum additional credits from hourly recovery'),
('max_total_credits', 8, 'Maximum credits a user can have at any time');

---------------------------------------------------------

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_credits_config_updated_at
BEFORE UPDATE ON public.credits_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

---------------------------------------------------------

-- Indexes
CREATE INDEX idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX idx_credits_config_key ON public.credits_config(config_key);
