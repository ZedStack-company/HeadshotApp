import React, { useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import CreditsDisplay from '../components/CreditsDisplay';
import { useUserCredits } from '../hooks/useUserCredits';
import { Button } from 'react-native-paper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ImageUploadScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { gender, style, background, suit, lighting } = route.params || {};
  
  const [image, setImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceBounds, setFaceBounds] = useState(null);
  const [error, setError] = useState('');
  const { credits, loading: creditsLoading, hasEnoughCredits, deductCredits } = useUserCredits();

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, []);

  const processImage = async (uri) => {
    try {
      setIsProcessing(true);
      setFaceDetected(false);
      setFaceBounds(null);
      
      // First, resize and compress the image
      const optimizedImage = await manipulateAsync(
        uri,
        [
          { resize: { width: 800 } }, // Resize to a reasonable size
        ],
        {
          compress: 0.7, // Slightly higher compression
          format: SaveFormat.JPEG,
          base64: true
        }
      );
      
      // Then simulate face detection
      setTimeout(() => {
        setImage(optimizedImage);
        // Simulate face detection
        setFaceDetected(true);
        setFaceBounds({
          x: 100,
          y: 100,
          width: 200,
          height: 200,
        });
        setIsProcessing(false);
      }, 500);
      
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleProcess = useCallback(async () => {
    try {
      setIsProcessing(true);
      setError('');
  
      // Validate inputs
      if (!faceDetected) {
        throw new Error('No face detected in the image');
      }
  
      // Check credits
      const enoughCredits = await hasEnoughCredits(1);
      if (!enoughCredits) {
        throw new Error('Insufficient credits');
      }
  
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Session expired. Please log in again.');
      }
  
      // Optimize uploaded image
      const uploadImage = await manipulateAsync(
        `data:image/jpeg;base64,${image.base64}`,
        [{ resize: { width: 1024 } }], // Resize for better quality
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
          base64: true
        }
      );
  
      // Build prompt
      const prompt = `A professional headshot of a ${gender} with ${style} style, wearing a ${suit}, in a ${background} setting with ${lighting} lighting, high quality, 8k, professional photography, sharp focus`;
  
      // Final request payload
      const requestData = {
        image: `data:image/jpeg;base64,${uploadImage.base64}`,
        gender,
        style,
        background,
        suit,
        lighting,
        faceBounds,
        prompt
      };
  
      console.log('Sending to API:', {
        ...requestData,
        image: '[BASE64_IMAGE_DATA]' // prevent console spam
      });
  
      // Call your Supabase function
      const response = await fetch(
        'https://nbepmasgfnqojtzmiprd.supabase.co/functions/v1/process-image',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestData),
        }
      );
  
      const result = await response.json();
  
      if (!response.ok) {
        console.error('Server error response:', result);
        throw new Error(result.error || 'Failed to process image');
      }
  
      if (!result.imageUrl) {
        throw new Error('No image URL returned from server');
      }
  
      // Deduct credits
      await deductCredits(1);
  
      // Navigate to results screen
      navigation.navigate('Result', { resultImage: result.imageUrl });
  
    } catch (error) {
      console.error('Error processing image:', error);
      setError(error.message || 'An error occurred. Please try again.');
      Alert.alert('Error', error.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  }, [image, gender, style, background, suit, lighting, faceDetected, faceBounds, hasEnoughCredits, deductCredits, navigation]);
  
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <CreditsDisplay style={styles.creditsDisplay} />
        
        <Text style={styles.title}>Upload Your Photo</Text>
        <Text style={styles.subtitle}>Please upload a clear photo of your face</Text>
        
        <View style={styles.uploadArea}>
          {isProcessing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Processing your image...</Text>
            </View>
          ) : image ? (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: `data:image/jpeg;base64,${image.base64}` }} 
                style={styles.imagePreview} 
                resizeMode="contain"
              />
              {faceBounds && (
                <View 
                  style={[
                    styles.faceBox,
                    {
                      left: `${faceBounds.x}%`,
                      top: `${faceBounds.y}%`,
                      width: `${faceBounds.width}%`,
                      height: `${faceBounds.height}%`,
                      borderColor: faceDetected ? '#4CAF50' : '#FF5722',
                    }
                  ]} 
                />
              )}
            </View>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.uploadButton, isProcessing && styles.disabledButton]}
            onPress={pickImage}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>
              {image ? 'Change Photo' : 'Select Photo'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {faceDetected && (
          <View style={styles.faceDetectedContainer}>
            <Text style={styles.faceDetectedText}>Face detected and ready to process</Text>
          </View>
        )}
      </ScrollView>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <Button
        mode="contained"
        onPress={handleProcess}
        loading={isProcessing}
        disabled={isProcessing || !faceDetected}
        style={styles.applyButton}
        labelStyle={styles.applyButtonLabel}
      >
        {isProcessing ? 'Processing...' : 'Apply Changes'}
      </Button>

      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Processing your image...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100,
  },
  creditsDisplay: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  uploadArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  faceBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  placeholderContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  faceDetectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  faceDetectedText: {
    marginLeft: 8,
    color: '#2E7D32',
    fontWeight: '500',
  },
  applyButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ImageUploadScreen;
