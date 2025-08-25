-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.use_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.reset_daily_credits();

-- Update user_credits table
ALTER TABLE public.user_credits 
  ADD COLUMN IF NOT EXISTS daily_credits_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_credit_recovery TIMESTAMPTZ DEFAULT NOW();

-- Update handle_new_user function
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
  
  -- Insert into user_credits with new defaults
  INSERT INTO public.user_credits (
    user_id, 
    current_credits,
    daily_credits_used,
    daily_credit_reset_time,
    last_credit_award_time,
    last_credit_recovery,
    total_credits_earned
  )
  VALUES (
    NEW.id,
    4,  -- Starting daily credits
    0,  -- No credits used yet
    DATE_TRUNC('day', NOW() + INTERVAL '1 day'),  -- Reset at next midnight
    NOW(),
    NOW(),
    4   -- Total credits earned starts at daily amount
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to recover credits hourly
CREATE OR REPLACE FUNCTION public.recover_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_recovered_credits INTEGER := 0;
  v_hours_since_last_recovery NUMERIC;
  v_max_additional_credits INTEGER;
  v_credits_to_recover INTEGER;
BEGIN
  -- Get time since last recovery and current state
  SELECT 
    EXTRACT(EPOCH FROM (NOW() - last_credit_recovery)) / 3600,
    LEAST(4, 4 - (daily_credits_used - 4))  -- Max 4 additional credits per day
  INTO v_hours_since_last_recovery, v_max_additional_credits
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;  -- Lock the row for update
  
  -- Calculate how many credits to recover (1 per hour, but not exceeding max)
  v_credits_to_recover := LEAST(
    FLOOR(v_hours_since_last_recovery)::INTEGER,  -- Full hours passed
    v_max_additional_credits,                     -- Not more than max additional
    8 - (SELECT current_credits FROM public.user_credits WHERE user_id = p_user_id)  -- Not exceeding 8 total
  );
  
  IF v_credits_to_recover > 0 THEN
    -- Update credits
    UPDATE public.user_credits
    SET 
      current_credits = LEAST(8, current_credits + v_credits_to_recover),
      last_credit_recovery = NOW(),
      last_credit_award_time = NOW()
    WHERE user_id = p_user_id
    RETURNING v_credits_to_recover INTO v_recovered_credits;
  END IF;
  
  RETURN v_recovered_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated use_credits function (2 credits per image)
CREATE OR REPLACE FUNCTION public.use_credits(
  p_user_id UUID,
  p_credits_to_use INTEGER DEFAULT 2  -- Default to 2 credits per image
) 
RETURNS JSONB AS $$
DECLARE
  v_current_credits INTEGER;
  v_daily_credits_used INTEGER;
  v_result JSONB;
  v_recovered_credits INTEGER;
BEGIN
  -- First, recover any available credits
  v_recovered_credits := public.recover_credits(p_user_id);
  
  -- Get current credits with row lock
  SELECT current_credits, daily_credits_used 
  INTO v_current_credits, v_daily_credits_used
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has enough credits
  IF v_current_credits >= p_credits_to_use THEN
    -- Update credits
    UPDATE public.user_credits
    SET 
      current_credits = current_credits - p_credits_to_use,
      daily_credits_used = daily_credits_used + p_credits_to_use,
      total_credits_used = COALESCE(total_credits_used, 0) + p_credits_to_use,
      last_credit_award_time = NOW()
    WHERE user_id = p_user_id
    RETURNING 
      jsonb_build_object(
        'success', true,
        'message', 'Credits used successfully',
        'remaining_credits', current_credits - p_credits_to_use,
        'credits_used', p_credits_to_use,
        'credits_recovered', v_recovered_credits
      ) INTO v_result;
  ELSE
    v_result := jsonb_build_object(
      'success', false,
      'message', 'Insufficient credits',
      'current_credits', v_current_credits,
      'required_credits', p_credits_to_use,
      'next_recovery_in_minutes', 60 - EXTRACT(MINUTE FROM NOW() - (SELECT last_credit_recovery FROM public.user_credits WHERE user_id = p_user_id)),
      'credits_recovered', v_recovered_credits
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily credits at midnight
CREATE OR REPLACE FUNCTION public.reset_daily_credits()
RETURNS void AS $$
BEGIN
  -- Reset daily credits and counters at midnight
  UPDATE public.user_credits
  SET 
    current_credits = 4,
    daily_credits_used = 0,
    daily_credit_reset_time = DATE_TRUNC('day', NOW() + INTERVAL '1 day'),
    last_credit_award_time = NOW(),
    last_credit_recovery = NOW()
  WHERE daily_credit_reset_time <= NOW();
  
  RAISE NOTICE 'Reset daily credits for % users', (SELECT COUNT(*) FROM public.user_credits WHERE daily_credit_reset_time <= NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cron job to reset credits at midnight
-- Note: This needs to be set up in your Supabase dashboard
-- SELECT cron.schedule('reset-daily-credits', '0 0 * * *', 'SELECT public.reset_daily_credits()');

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.use_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_daily_credits() TO authenticated;
