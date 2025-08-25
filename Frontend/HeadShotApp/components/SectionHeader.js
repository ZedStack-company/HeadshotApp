import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SectionHeader = ({ title, description, style }) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {description && (
        <Text style={styles.description} accessibilityRole="text">
          {description}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default SectionHeader;
