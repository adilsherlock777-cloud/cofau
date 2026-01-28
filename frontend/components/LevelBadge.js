import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * LevelBadge Component
 * Small circular badge showing level number
 * Positioned at bottom-left of profile picture (like Image 3 reference)
 */
export default function LevelBadge({ level, size = 'small' }) {
  if (!level || level < 1) return null;

  // Determine badge color based on level band
  const getBadgeColor = (level) => {
    if (level >= 1 && level <= 4) return '#FF5C5C'; // Green for Reviewer
    if (level >= 5 && level <= 8) return '#F2CF68'; // Orange for Top Reviewer
    if (level >= 9 && level <= 12) return '#E94A37'; // Pink for Influencer
    return '#FF4444'; // Default
  };

  // Size configurations
  const sizeConfig = {
    small: {
      container: 14,
      fontSize: 8,
      borderWidth: 1,
    },
    medium: {
      container: 18,
      fontSize: 10,
      borderWidth: 2,
    },
    large: {
      container: 24,
      fontSize: 12,
      borderWidth: 2,
    },
  };

  const config = sizeConfig[size] || sizeConfig.small;
  const badgeColor = getBadgeColor(level);

  return (
    <View
      style={[
        styles.badge,
        {
          width: config.container,
          height: config.container,
          borderRadius: config.container / 2,
          backgroundColor: badgeColor,
          borderWidth: config.borderWidth,
        },
      ]}
    >
      <Text style={[styles.levelText, { fontSize: config.fontSize }]}>
        {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  levelText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});