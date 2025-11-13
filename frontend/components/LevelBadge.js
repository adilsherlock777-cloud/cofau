import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * LevelBadge Component
 * Displays a circular badge with level number
 * Positioned at bottom-right of profile picture
 * Color-coded by level band
 */
export default function LevelBadge({ level, size = 'medium' }) {
  if (!level) return null;

  // Determine badge color based on level band
  const getBadgeColor = (level) => {
    if (level >= 1 && level <= 4) return '#4CAF50'; // Green for Reviewer
    if (level >= 5 && level <= 8) return '#FF9800'; // Orange for Top Reviewer
    if (level >= 9 && level <= 12) return '#E91E63'; // Pink for Influencer
    return '#4CAF50'; // Default
  };

  // Size configurations
  const sizeConfig = {
    small: {
      container: 18,
      fontSize: 10,
      borderWidth: 1.5,
    },
    medium: {
      container: 22,
      fontSize: 11,
      borderWidth: 2,
    },
    large: {
      container: 28,
      fontSize: 13,
      borderWidth: 2.5,
    },
  };

  const config = sizeConfig[size] || sizeConfig.medium;
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
    position: 'absolute',
    bottom: -2,
    right: -2,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 10,
  },
  levelText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
