import { renderHook, act } from '@testing-library/react-hooks';
import { useUserCredits, hasEnoughCredits, deductCredits } from '../hooks/useUserCredits';
import { supabase } from '../lib/supabase';

// Mock the supabase client
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('useUserCredits', () => {
  const mockSession = {
    user: { id: 'test-user-id' },
  };

  const mockCreditsData = {
    id: 'credit-1',
    user_id: 'test-user-id',
    current_credits: 5,
    daily_credits_used: 0,
    daily_credit_reset_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    last_credit_recovery: new Date().toISOString(),
    total_credits_earned: 10,
    total_credits_used: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock getSession
    supabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    
    // Mock from().select()
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: mockCreditsData,
      error: null,
    });
    
    supabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });
    
    // Mock channel
    const mockOn = jest.fn().mockReturnThis();
    const mockSubscribe = jest.fn().mockReturnValue({
      unsubscribe: jest.fn(),
    });
    
    supabase.channel.mockReturnValue({
      on: mockOn,
      subscribe: mockSubscribe,
    });
  });

  it('should fetch initial credits', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useUserCredits());
    
    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.credits).toBeNull();
    expect(result.current.error).toBeNull();
    
    // Wait for the hook to finish loading
    await waitForNextUpdate();
    
    // Verify the credit data was fetched
    expect(supabase.from).toHaveBeenCalledWith('user_credits');
    expect(result.current.loading).toBe(false);
    expect(result.current.credits).toEqual(mockCreditsData);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors when fetching credits', async () => {
    const errorMessage = 'Failed to fetch credits';
    
    // Mock error response
    supabase.from().select().eq().single.mockResolvedValue({
      data: null,
      error: { message: errorMessage },
    });
    
    const { result, waitForNextUpdate } = renderHook(() => useUserCredits());
    
    await waitForNextUpdate();
    
    expect(result.current.loading).toBe(false);
    expect(result.current.credits).toBeNull();
    expect(result.current.error).toContain(errorMessage);
  });

  it('should set up real-time subscription', async () => {
    const { waitForNextUpdate } = renderHook(() => useUserCredits());
    await waitForNextUpdate();
    
    // Verify channel was created with correct parameters
    expect(supabase.channel).toHaveBeenCalledWith('user_credits_changes');
    
    // Verify subscription was set up
    const channelMock = supabase.channel();
    expect(channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_credits',
        filter: 'user_id=eq.test-user-id',
      },
      expect.any(Function)
    );
    
    expect(channelMock.subscribe).toHaveBeenCalled();
  });

  it('should clean up subscription on unmount', async () => {
    const { unmount, waitForNextUpdate } = renderHook(() => useUserCredits());
    await waitForNextUpdate();
    
    unmount();
    
    // Verify channel was removed
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});

describe('hasEnoughCredits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
    });
    
    supabase.rpc.mockResolvedValue({
      data: true,
      error: null,
    });
  });
  
  it('should check if user has enough credits', async () => {
    const result = await hasEnoughCredits(3);
    
    expect(supabase.rpc).toHaveBeenCalledWith('check_user_credits', {
      user_id: 'test-user-id',
      required_credits: 3,
    });
    
    expect(result).toBe(true);
  });
  
  it('should handle errors', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    });
    
    const result = await hasEnoughCredits(3);
    expect(result).toBe(false);
  });
  
  it('should return false if no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    
    const result = await hasEnoughCredits(3);
    expect(result).toBe(false);
  });
});

describe('deductCredits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
    });
    
    supabase.rpc.mockResolvedValue({
      data: { success: true, remaining_credits: 2 },
      error: null,
    });
  });
  
  it('should deduct credits', async () => {
    const result = await deductCredits(1);
    
    expect(supabase.rpc).toHaveBeenCalledWith('deduct_credits', {
      user_id: 'test-user-id',
      amount: 1,
    });
    
    expect(result).toEqual({
      success: true,
      remaining_credits: 2,
    });
  });
  
  it('should handle errors', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Insufficient credits' },
    });
    
    const result = await deductCredits(1);
    expect(result).toEqual({
      success: false,
      error: 'Insufficient credits',
    });
  });
  
  it('should handle no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    
    const result = await deductCredits(1);
    expect(result).toEqual({
      success: false,
      error: 'No active session',
    });
  });
});
