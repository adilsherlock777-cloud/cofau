import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface FirstDiscoveryBadgeProps {
  size?: number;
}

export default function FirstDiscoveryBadge({ size = 12 }: FirstDiscoveryBadgeProps) {
  const fontSize = size * 0.85;
  const iconSize = size;
  const paddingH = size * 0.5;
  const paddingV = size * 0.2;
  const borderRadius = size * 0.8;

  return (
    <LinearGradient
      colors={['#FF2E2E', '#FF7A18']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        {
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderRadius: borderRadius,
        },
      ]}
    >
      <MaterialCommunityIcons name="star-four-points" size={iconSize} color="#fff" />
      <Text style={[styles.text, { fontSize }]}>First Discovery</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
