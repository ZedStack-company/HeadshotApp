// Mock AsyncStorage
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Mock Supabase
jest.mock('../lib/supabase', () => {
  let mockCredits = 5;
  
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { 
            session: { 
              user: { 
                id: 'test-user-id',
                email: 'test@example.com'
              } 
            } 
          },
          error: null,
        }),
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'test-credit-id',
          user_id: 'test-user-id',
          current_credits: 5,
          daily_credits_used: 0,
          daily_credit_reset_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          last_credit_recovery: new Date().toISOString(),
          total_credits_earned: 10,
          total_credits_used: 5,
        },
        error: null,
      }),
      insert: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockImplementation((fnName, { amount }) => {
        if (fnName === 'deduct_credits') {
          mockCredits -= amount;
          return Promise.resolve({
            data: { 
              success: true, 
              remaining_credits: mockCredits,
              message: 'Credits deducted successfully'
            },
            error: null,
          });
        }
        if (fnName === 'check_user_credits') {
          return Promise.resolve({
            data: { 
              success: true, 
              has_enough: mockCredits >= 1,
              credits_available: mockCredits,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: jest.fn(),
        }),
      }),
      removeChannel: jest.fn(),
    },
  };
});

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{
      uri: 'test-image-uri',
      width: 800,
      height: 800,
    }],
  }),
  MediaTypeOptions: { Images: 'Images' },
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'processed-image-uri',
    base64: 'base64-encoded-image',
  }),
  SaveFormat: { JPEG: 'jpeg' },
}));

// Mock Alert
jest.spyOn(require('react-native'), 'Alert').mockImplementation((...args) => {
  console.log('Alert called with:', args);
  return {
    alert: jest.fn(),
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock global.fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Add React Native's Animated implementation
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock React Navigation
const mockedNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockedNavigate,
      goBack: jest.fn(),
      addListener: jest.fn(),
    }),
    useRoute: () => ({
      params: {
        gender: 'male',
        style: 'professional',
        background: 'office',
        suit: 'suit1',
        lighting: 'natural',
      },
    }),
  };
});
