-- 1. Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS create_credits ON auth.users;
DROP FUNCTION IF EXISTS public.create_credits();

-- 2. Drop and recreate the credits table with proper constraints
DROP TABLE IF EXISTS public.credits;

-- 3. Create the user_credits table with proper structure
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_credits INTEGER NOT NULL DEFAULT 4,
  last_credit_award_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  daily_credit_reset_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles if not exists
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert into user_credits if not exists
  INSERT INTO public.user_credits (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger for new user signup if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END
$$;

-- 6. Create function to reset daily credits
CREATE OR REPLACE FUNCTION public.reset_daily_credits() 
RETURNS void AS $$
BEGIN
  UPDATE public.user_credits
  SET 
    current_credits = 4,
    daily_credit_reset_time = NOW(),
    updated_at = NOW()
  WHERE daily_credit_reset_time::date < NOW()::date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enable RLS on user_credits table if not already enabled
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- 8. Drop existing policy if it exists, then recreate
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE tablename = 'user_credits' 
    AND policyname = 'Users can view their own credits'
  ) THEN
    DROP POLICY "Users can view their own credits" ON public.user_credits;
  END IF;
  
  CREATE POLICY "Users can view their own credits"
  ON public.user_credits
  FOR SELECT
  USING (auth.uid() = user_id);
END
$$;

-- 9. Grant necessary permissions
GRANT SELECT, UPDATE ON public.user_credits TO authenticated;
GRANT SELECT ON public.user_credits TO anon;

-- 10. Create or replace function to get current user's credits
CREATE OR REPLACE FUNCTION public.get_user_credits()
RETURNS TABLE (
  current_credits INTEGER,
  last_credit_award_time TIMESTAMPTZ,
  daily_credit_reset_time TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uc.current_credits,
    uc.last_credit_award_time,
    uc.daily_credit_reset_time
  FROM public.user_credits uc
  WHERE uc.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
