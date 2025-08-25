-- Function to check user's available credits
CREATE OR REPLACE FUNCTION public.check_user_credits(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_credits_record RECORD;
  v_credits_available INTEGER;
  v_next_reset_seconds INTEGER;
  v_next_recovery_seconds INTEGER;
  v_result JSONB;
BEGIN
  -- First, recover any available credits
  PERFORM public.recover_credits(p_user_id);
  
  -- Get current credits with recovery information
  SELECT 
    uc.current_credits,
    EXTRACT(EPOCH FROM (uc.daily_credit_reset_time - NOW()))::INTEGER as seconds_until_reset,
    LEAST(3600, 3600 - EXTRACT(EPOCH FROM (NOW() - uc.last_credit_recovery))::INTEGER) as seconds_until_next_recovery,
    uc.daily_credits_used,
    uc.total_credits_earned,
    uc.total_credits_used
  INTO v_credits_record
  FROM public.user_credits uc
  WHERE uc.user_id = p_user_id
  FOR UPDATE SKIP LOCKED;  -- Prevent blocking other transactions
  
  IF NOT FOUND THEN
    -- User credits record doesn't exist, create it with default values
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
      p_user_id,
      4,  -- Starting daily credits
      0,  -- No credits used yet
      DATE_TRUNC('day', NOW() + INTERVAL '1 day'),  -- Reset at next midnight
      NOW(),
      NOW(),
      4   -- Total credits earned starts at daily amount
    )
    RETURNING 
      current_credits,
      EXTRACT(EPOCH FROM (daily_credit_reset_time - NOW()))::INTEGER as seconds_until_reset,
      3600 as seconds_until_next_recovery,
      daily_credits_used,
      total_credits_earned,
      total_credits_used
    INTO v_credits_record;
  END IF;
  
  -- Ensure we don't return negative values
  v_credits_available := GREATEST(0, COALESCE(v_credits_record.current_credits, 0));
  v_next_reset_seconds := GREATEST(0, v_credits_record.seconds_until_reset);
  v_next_recovery_seconds := GREATEST(0, LEAST(3600, v_credits_record.seconds_until_next_recovery));
  
  -- Build the result
  v_result := jsonb_build_object(
    'success', true,
    'credits_available', v_credits_available,
    'credits_used_today', v_credits_record.daily_credits_used,
    'total_credits_earned', v_credits_record.total_credits_earned,
    'total_credits_used', v_credits_record.total_credits_used,
    'next_reset_seconds', v_next_reset_seconds,
    'next_recovery_seconds', v_next_recovery_seconds,
    'can_generate', v_credits_available >= 2  -- 2 credits needed per generation
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error checking credits: ' || SQLERRM,
      'credits_available', 0,
      'can_generate', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely deduct credits with retry logic
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_credits_to_deduct INTEGER DEFAULT 2  -- Default to 2 credits per image
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_retry_count INTEGER := 0;
  v_max_retries INTEGER := 3;
  v_retry_delay INTERVAL := '100 milliseconds';
  v_success BOOLEAN := false;
BEGIN
  -- Try to use credits with retry logic for concurrency
  WHILE v_retry_count < v_max_retries AND NOT v_success LOOP
    BEGIN
      -- Use the existing use_credits function which has proper locking
      v_result := public.use_credits(p_user_id, p_credits_to_deduct);
      v_success := (v_result->>'success')::BOOLEAN;
      
      -- If we got a success or a non-concurrency error, exit the loop
      IF v_success OR (v_result->>'message') NOT LIKE '%concurrent%' THEN
        EXIT;
      END IF;
      
      -- If we get here, it's a concurrency issue, so wait and retry
      v_retry_count := v_retry_count + 1;
      IF v_retry_count < v_max_retries THEN
        PERFORM pg_sleep(EXTRACT(EPOCH FROM v_retry_delay * v_retry_count));
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log the error and retry
      v_retry_count := v_retry_count + 1;
      IF v_retry_count >= v_max_retries THEN
        -- If we've exhausted retries, return the error
        RETURN jsonb_build_object(
          'success', false,
          'message', 'Failed to deduct credits after ' || v_max_retries || ' attempts: ' || SQLERRM
        );
      END IF;
      
      -- Wait before retrying
      PERFORM pg_sleep(EXTRACT(EPOCH FROM v_retry_delay * v_retry_count));
    END;
  END LOOP;
  
  -- If we've exhausted retries without success
  IF NOT v_success AND v_retry_count >= v_max_retries THEN
    v_result := jsonb_build_object(
      'success', false,
      'message', 'Failed to deduct credits after maximum retries',
      'credits_available', 0,
      'can_generate', false
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER) TO authenticated;
