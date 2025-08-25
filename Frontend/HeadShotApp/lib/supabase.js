import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://nbepmasgfnqojtzmiprd.supabase.co'; // e.g., 'https://your-project-id.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZXBtYXNnZm5xb2p0em1pcHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMTc2NzIsImV4cCI6MjA3MTU5MzY3Mn0.zQjdc0qBmBFQQA33zWkTDeugI8iYtDYtyDg5EntJgfg'; // The 'anon' public key from Project Settings > API

// Initialize the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Enhanced error handler
const handleError = (error) => {
  console.error('Supabase Error:', {
    message: error.message,
    status: error.status,
    response: error.response,
    stack: error.stack,
  });
  throw error;
};

export const signUp = async (email, password) => {
  try {
    console.log('Attempting to sign up with:', { email });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    });

    if (error) {
      console.error('Signup Error Details:', {
        status: error.status,
        message: error.message,
        details: error.error_description || error.message,
      });
      throw error;
    }

    console.log('Signup successful, data:', data);
    return data;
  } catch (error) {
    console.error('Signup failed with error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
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
      console.error('Signin Error Details:', {
        status: error.status,
        message: error.message,
        details: error.error_description || error.message,
      });
      throw error;
    }

    console.log('Signin successful, data:', data);
    return data;
  } catch (error) {
    console.error('Signin failed with error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
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
    const { data: { session }, error } = await supabase.auth.getSession();
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
