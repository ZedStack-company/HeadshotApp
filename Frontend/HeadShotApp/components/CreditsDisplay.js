import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useUserCredits } from '../hooks/useUserCredits';
import { colors, spacing, typography } from '../constants/theme';

const CreditsDisplay = ({ style }) => {
  const { credits, loading, error } = useUserCredits();

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Error loading credits</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.creditsText}>
        Credits: <Text style={styles.creditsCount}>{credits?.current_credits || 0}</Text>
      </Text>
      {credits?.daily_credit_reset_time && (
        <Text style={styles.resetText}>
          Resets in: {formatTimeUntilReset(credits.daily_credit_reset_time)}
        </Text>
      )}
    </View>
  );
};

// Helper function to format time until reset
const formatTimeUntilReset = (resetTime) => {
  const now = new Date();
  const reset = new Date(resetTime);
  const diffMs = reset - now;
  
  if (diffMs <= 0) return 'Soon';
  
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    margin: spacing.sm,
  },
  creditsText: {
    ...typography.body,
    color: colors.darkGray,
  },
  creditsCount: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  resetText: {
    ...typography.caption,
    color: colors.gray,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
  },
});

export default CreditsDisplay;
