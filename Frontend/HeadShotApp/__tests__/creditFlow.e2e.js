import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import ImageUploadScreen from '../screens/ImageUploadScreen';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

// Mock the navigation
const Stack = createStackNavigator();

// Mock the supabase client
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
jest.spyOn(Alert, 'alert');

describe('Credit Flow', () => {
  const renderApp = () => {
    return render(
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            initialParams={{
              gender: 'male',
              style: 'professional',
              background: 'office',
              suit: 'suit1',
              lighting: 'natural',
            }}
          />
          <Stack.Screen 
            name="ImageUpload" 
            component={ImageUploadScreen} 
            initialParams={{
              gender: 'male',
              style: 'professional',
              background: 'office',
              suit: 'suit1',
              lighting: 'natural',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockCredits to initial value
    supabase.supabase.rpc.mockImplementation((fnName, { amount }) => {
      if (fnName === 'deduct_credits') {
        return Promise.resolve({
          data: { 
            success: true, 
            remaining_credits: 5 - (amount || 1),
            message: 'Credits deducted successfully'
          },
          error: null,
        });
      }
      if (fnName === 'check_user_credits') {
        return Promise.resolve({
          data: { 
            success: true, 
            has_enough: 5 >= (amount || 1),
            credits_available: 5,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('should display initial credits on home screen', async () => {
    renderApp();
    
    // Check if credits are displayed
    await waitFor(() => {
      expect(screen.getByText(/credits available/i)).toBeTruthy();
      expect(screen.getByText(/5/)).toBeTruthy();
    });
  });

  it('should navigate to image upload and deduct credits on successful processing', async () => {
    // Mock the fetch response for image processing
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        imageUrl: 'https://example.com/processed-image.jpg',
      }),
    });

    const { getByText, getByTestId } = renderApp();
    
    // Navigate to ImageUpload screen
    fireEvent.press(getByText(/continue/i));
    
    // Wait for navigation
    await waitFor(() => {
      expect(screen.getByText(/upload your photo/i)).toBeTruthy();
    });
    
    // Select an image
    fireEvent.press(getByText(/select photo/i));
    
    // Process the image
    await act(async () => {
      fireEvent.press(getByText(/process image/i));
    });
    
    // Verify credits were checked and deducted
    expect(supabase.supabase.rpc).toHaveBeenCalledWith('check_user_credits', {
      user_id: 'test-user-id',
      required_credits: 1,
    });
    
    expect(supabase.supabase.rpc).toHaveBeenCalledWith('deduct_credits', {
      user_id: 'test-user-id',
      amount: 1,
    });
    
    // Verify the processed image is displayed
    await waitFor(() => {
      expect(screen.getByText(/your professional headshot/i)).toBeTruthy();
    });
  });

  it('should show insufficient credits alert when user has 0 credits', async () => {
    // Mock check_user_credits to return 0 credits
    supabase.supabase.rpc.mockImplementation((fnName) => {
      if (fnName === 'check_user_credits') {
        return Promise.resolve({
          data: { 
            success: true, 
            has_enough: false,
            credits_available: 0,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderApp();
    
    // Navigate to ImageUpload screen
    fireEvent.press(screen.getByText(/continue/i));
    
    // Wait for navigation
    await waitFor(() => {
      expect(screen.getByText(/upload your photo/i)).toBeTruthy();
    });
    
    // Select an image
    fireEvent.press(screen.getByText(/select photo/i));
    
    // Try to process the image
    await act(async () => {
      fireEvent.press(screen.getByText(/process image/i));
    });
    
    // Verify the insufficient credits alert was shown
    expect(Alert.alert).toHaveBeenCalledWith(
      'Insufficient Credits',
      'You do not have enough credits to process this image. Please try again later or contact support.'
    );
  });
});
