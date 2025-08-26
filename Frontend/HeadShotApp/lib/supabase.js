import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'react-native';

// Replace with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://nbepmasgfnqojtzmiprd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZXBtYXNnZm5xb2p0em1pcHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMTc2NzIsImV4cCI6MjA3MTU5MzY3Mn0.zQjdc0qBmBFQQA33zWkTDeugI8iYtDYtyDg5EntJgfg';

// Initialize the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN doesn’t have window.location
  },
});

// Error handler
const handleError = (error) => {
  console.error('Supabase Error:', {
    message: error.message,
    status: error.status,
    response: error.response,
    stack: error.stack,
  });
  throw error;
};

// ---------- AUTH HELPERS ---------- //

export const signUp = async (email, password) => {
  try {
    console.log('Attempting to sign up with:', { email });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'headshotapp://auth/callback', // deep link redirect
      },
    });

    if (error) {
      console.error('Signup Error:', error);
      throw error;
    }

    console.log('Signup successful, data:', data);
    return data;
  } catch (error) {
    handleError(error);
  }
};

export const signIn = async (email, password) => {
  try {
    console.log('Attempting to sign in with:', { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Signin Error:', error);
      throw error;
    }

    console.log('Signin successful, data:', data);
    return data;
  } catch (error) {
    handleError(error);
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    handleError(error);
  }
};

export const getCurrentUser = async () => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    return { data: { user: session?.user || null }, error: null };
  } catch (error) {
    console.error('Error getting current user:', error);
    return { data: { user: null }, error };
  }
};

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};

// ---------- DEEP LINK HANDLING ---------- //

/**
 * Call this once in App.js inside useEffect()
 * It listens for deep links like headshotapp://auth/callback
 * and exchanges them for a Supabase session
 */
export const initDeepLinkListener = () => {
  const handleDeepLink = async (event) => {
    const url = event.url;
    console.log('Deep link received:', url);

    if (url) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) {
        console.error('Error exchanging code for session:', error.message);
      } else {
        console.log('Session established:', data.session);
      }
    }
  };

  // Listen for deep links while app is running
  const subscription = Linking.addEventListener('url', handleDeepLink);

  // Handle deep link if app was opened via one initially
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink({ url });
  });

  return () => subscription.remove();
};
