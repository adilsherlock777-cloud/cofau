import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * LevelBadge Component
 * Small circular badge showing level number
 * Positioned at bottom-right of profile picture
 * Matches Instagram notification badge style
 */
export default function LevelBadge({ level, size = 'small' }) {
  if (!level || level < 1) return null;

  // Determine badge color based on level band
  const getBadgeColor = (level) => {
    if (level >= 1 && level <= 4) return '#4CAF50'; // Green for Reviewer
    if (level >= 5 && level <= 8) return '#FF9800'; // Orange for Top Reviewer
    if (level >= 9 && level <= 12) return '#E91E63'; // Pink for Influencer
    return '#4CAF50'; // Default
  };

  // Size configurations - kept small like Instagram badges
  const sizeConfig = {
    small: {
      container: 16,
      fontSize: 9,
      borderWidth: 1.5,
      bottom: 0,
      right: 0,
    },
    medium: {
      container: 20,
      fontSize: 10,
      borderWidth: 2,
      bottom: 2,
      right: 2,
    },
    large: {
      container: 24,
      fontSize: 11,
      borderWidth: 2,
      bottom: 2,
      right: 2,
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
          bottom: config.bottom,
          right: config.right,
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
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  levelText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
