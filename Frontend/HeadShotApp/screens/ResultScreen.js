import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function ResultScreen({ route }) {
  const { resultImage } = route.params || {};
  return (
    <View style={styles.container}>
      {resultImage ? (
        <Image source={{ uri: resultImage }} style={styles.image} resizeMode="contain" />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16, justifyContent: 'center' },
  image: { width: '100%', height: '80%' },
});