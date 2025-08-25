import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useUserCredits = (userId = null) => {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCredits = useCallback(async (id = null) => {
    try {
      setLoading(true);
      setError(null);
      
      // If no ID is provided, try to get it from the session
      let targetUserId = id;
      if (!targetUserId) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        targetUserId = session?.user?.id;
      }
      
      if (!targetUserId) {
        setLoading(false);
        return null;
      }

      // Fetch user credits
      const { data, error: fetchError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', targetUserId)
        .single();
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') { // No rows returned
          // Create a new credits record if none exists
          const { data: newCredits, error: createError } = await supabase
            .from('user_credits')
            .insert([{ 
              user_id: targetUserId, 
              current_credits: 0, 
              total_credits_used: 0 
            }])
            .select()
            .single();
            
          if (createError) throw createError;
          setCredits(newCredits);
          return newCredits;
        }
        throw fetchError;
      }
      
      setCredits(data);
      return data;
      
    } catch (err) {
      console.error('Error in fetchCredits:', err);
      setError(err.message);
      setCredits(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCredits(userId);
  }, [fetchCredits, userId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!credits?.user_id) return;

    const channel = supabase
      .channel('user_credits_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${credits.user_id}`,
        },
        (payload) => {
          setCredits(payload.new);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [credits?.user_id]);

  const hasEnoughCredits = useCallback(async (requiredCredits = 1) => {
    if (!credits) {
      const freshCredits = await fetchCredits(userId);
      return (freshCredits?.current_credits || 0) >= requiredCredits;
    }
    return (credits.current_credits || 0) >= requiredCredits;
  }, [credits, fetchCredits, userId]);

  const deductCredits = useCallback(async (amount = 1) => {
    if (!credits?.user_id) {
      throw new Error('No user credits record found');
    }

    const { data, error } = await supabase.rpc('deduct_credits', {
      user_id: credits.user_id,
      amount: amount
    });

    if (error) throw error;
    
    // Support both return shapes: integer or { success, remaining_credits }
    const newBalance =
      typeof data === 'number'
        ? data
        : (data && typeof data === 'object' && (data.remaining_credits ?? null));

    if (newBalance === null || newBalance === undefined) {
      // Unknown return shape; just refetch to stay consistent
      const refreshed = await fetchCredits(credits.user_id);
      return refreshed;
    }

    const updatedCredits = {
      ...credits,
      current_credits: newBalance,
      total_credits_used: (credits.total_credits_used || 0) + amount,
    };
    setCredits(updatedCredits);
    return updatedCredits;
  }, [credits, fetchCredits]);

  return {
    credits,
    loading,
    error,
    hasEnoughCredits,
    deductCredits,
    refetch: () => fetchCredits(userId)
  };
};
