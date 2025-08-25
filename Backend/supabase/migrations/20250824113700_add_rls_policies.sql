-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_mappings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
    -- Profiles table policies
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile') THEN
        DROP POLICY "Users can view their own profile" ON public.profiles;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
        DROP POLICY "Users can update their own profile" ON public.profiles;
    END IF;
    
    -- User credits policies
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can view their own credits') THEN
        DROP POLICY "Users can view their own credits" ON public.user_credits;
    END IF;
    
    -- Credits config policies
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credits_config' AND policyname = 'Only admin can manage credit config') THEN
        DROP POLICY "Only admin can manage credit config" ON public.credits_config;
    END IF;
    
    -- Prompt mappings policies
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prompt_mappings' AND policyname = 'Authenticated users can read prompt mappings') THEN
        DROP POLICY "Authenticated users can read prompt mappings" ON public.prompt_mappings;
    END IF;
END $$;

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
