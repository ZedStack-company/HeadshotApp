import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View, Platform } from 'react-native';
import { colors } from '../constants/theme';

const ContinueButton = ({
  onPress,
  disabled = false,
  loading = false,
  title = 'Continue',
  style,
  textStyle,
}) => {
  // Platform-specific shadow styles
  const shadowStyle = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },
    android: {
      elevation: 2,
    },
    default: {
      // web and other platforms
      boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.2)',
    },
  });

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          shadowStyle,
          disabled && styles.disabledButton,
          loading && styles.loadingButton,
        ]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={[styles.buttonText, textStyle]}>{title}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
  },
  button: {
    backgroundColor: '#007AFF', // Primary blue color
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  disabledButton: {
    backgroundColor: '#A0D1FF', // Lighter blue when disabled
    opacity: 0.7,
  },
  loadingButton: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ContinueButton;
