-- Update the handle_new_user function to set default credits
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
  
  -- Insert into user_credits with default values
  INSERT INTO public.user_credits (
    user_id, 
    current_credits, 
    daily_credit_reset_time,
    last_credit_award_time,
    total_credits_earned
  )
  VALUES (
    NEW.id,
    10,  -- Default starting credits
    NOW(),
    NOW(),
    10   -- Total credits earned starts at default
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    current_credits = 10,
    daily_credit_reset_time = NOW(),
    last_credit_award_time = NOW(),
    total_credits_earned = 10;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the function was updated
SELECT 
    routine_name,
    routine_definition
FROM 
    information_schema.routines
WHERE 
    routine_name = 'handle_new_user'
    AND routine_schema = 'public';
