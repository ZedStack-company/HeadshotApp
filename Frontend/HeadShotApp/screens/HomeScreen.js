import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useUserCredits } from '../hooks/useUserCredits';
import { 
  OptionCard, 
  GenderButton, 
  SectionHeader, 
  ContinueButton 
} from '../components';
import { 
  GENDER_OPTIONS, 
  STYLE_OPTIONS, 
  BACKGROUND_OPTIONS, 
  SUIT_OPTIONS, 
  LIGHTING_OPTIONS 
} from '../constants/options';
import { colors, spacing, typography } from '../constants/theme';
import CreditsDisplay from '../components/CreditsDisplay';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [selections, setSelections] = useState({
    gender: null,
    style: null,
    background: 'office',
    suit: 'suit',
    lighting: 'studio',
  });
  
  const { credits, loading: creditsLoading } = useUserCredits();
  const hasEnoughCredits = credits?.current_credits > 0;

  const handleSelect = useCallback((category, value) => {
    setSelections(prev => ({
      ...prev,
      [category]: value
    }));
  }, []);

  const handleContinue = useCallback(() => {
    if (!hasEnoughCredits) {
      Alert.alert(
        'Insufficient Credits',
        'You need at least 1 credit to create headshots. Please try again later or contact support.'
      );
      return;
    }
    
    if (!selections.gender || !selections.style) {
      Alert.alert(
        'Incomplete Selections',
        'Please select both gender and style before continuing.'
      );
      return;
    }
    
    const navigationParams = {
      ...selections,
      gender: selections.gender || 'male',
      style: selections.style || 'professional',
      background: selections.background || 'office',
      suit: selections.suit || 'suit',
      lighting: selections.lighting || 'studio',
    };

    console.log('Navigating to ImageUpload with params:', navigationParams);
    
    navigation.navigate('ImageUpload', navigationParams);
  }, [selections, hasEnoughCredits, navigation]);

  const isFormComplete = selections.gender && selections.style;
  
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <CreditsDisplay style={styles.creditsDisplay} />
        
        <SectionHeader 
          title="Create Professional Headshots" 
          description="Select your preferences to generate AI-powered professional headshots"
        />
        
        <View style={styles.section}>
          <SectionHeader 
            title="1. Select Gender" 
            description="Choose the gender for your headshot"
            required
          />
          <View style={styles.genderContainer}>
            {GENDER_OPTIONS.map((option) => (
              <GenderButton
                key={option.value}
                label={option.label}
                image={option.image}
                isSelected={selections.gender === option.value}
                onSelect={() => handleSelect('gender', option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader 
            title="2. Choose Style" 
            description="Select a style for your headshot"
            required
          />
          <View style={styles.optionsGrid}>
            {STYLE_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                id={option.value}
                name={option.label}
                image={option.image}
                isSelected={selections.style === option.value}
                onSelect={() => handleSelect('style', option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader 
            title="3. Customize Background" 
            description="Select a background for your headshot"
          />
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalOptions}
          >
            {BACKGROUND_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                id={option.value}
                name={option.label}
                image={option.image}
                isSelected={selections.background === option.value}
                onSelect={() => handleSelect('background', option.value)}
                width={140}
                height={160}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader 
            title="4. Select Suit Style" 
            description="Choose your preferred suit style"
          />
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalOptions}
          >
            {SUIT_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                id={option.value}
                name={option.label}
                image={option.image}
                isSelected={selections.suit === option.value}
                onSelect={() => handleSelect('suit', option.value)}
                width={140}
                height={160}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader 
            title="5. Choose Lighting" 
            description="Select the lighting for your headshot"
          />
          <View style={styles.optionsGrid}>
            {LIGHTING_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                id={option.value}
                name={option.label}
                image={option.image}
                isSelected={selections.lighting === option.value}
                onSelect={() => handleSelect('lighting', option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.continueButtonContainer}>
          <ContinueButton 
            onPress={handleContinue}
            disabled={!isFormComplete || !hasEnoughCredits}
            title="Continue to Upload"
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  creditsDisplay: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  horizontalOptions: {
    paddingVertical: spacing.sm,
  },
  optionCard: {
    marginRight: spacing.md,
  },
  continueButtonContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
});

export default HomeScreen;
