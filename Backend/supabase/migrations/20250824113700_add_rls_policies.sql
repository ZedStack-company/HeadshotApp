-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_mappings ENABLE ROW LEVEL SECURITY;

-- Profiles table policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- User credits policies
CREATE POLICY "Users can view their own credits"
ON public.user_credits FOR SELECT
USING (auth.uid() = user_id);

-- Credits config (admin only)
CREATE POLICY "Only admin can manage credit config"
ON public.credits_config
USING (auth.role() = 'service_role');

-- Prompt mappings (read-only for all authenticated users)
CREATE POLICY "Authenticated users can read prompt mappings"
ON public.prompt_mappings FOR SELECT
TO authenticated
USING (true);
