import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChange, supabase } from './lib/supabase';

// Screens
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import ImageUploadScreen from './screens/ImageUploadScreen';
import ResultScreen from './screens/ResultScreen';

const Stack = createNativeStackNavigator();

// Loading component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#0000ff" />
  </View>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on initial load
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data?.user) {
          console.log('No valid session → logging out');
          await supabase.auth.signOut(); // clear any stale session
          setUser(null);
        } else {
          setUser(data.user);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Set up auth state change listener
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      if (!session) {
        setUser(null);
      } else {
        setUser(session.user);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Show loading state while checking auth
  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {user ? (
          // User is signed in
          <>
            <Stack.Screen 
              name="Home" 
              component={HomeScreen} 
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="ImageUpload" 
              component={ImageUploadScreen}
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen 
              name="Result" 
              component={ResultScreen} 
              options={{ title: 'Your Headshot' }} 
            />
          </>
        ) : (
          // User is not signed in
          <>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
              options={{
                headerShown: false,
                animation: 'fade',
              }}
            />
            <Stack.Screen 
              name="SignUp" 
              component={SignUpScreen} 
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
