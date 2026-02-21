import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CofauVerifiedBadgeProps {
  size?: number;
  animate?: boolean;
}

/**
 * CofauVerifiedBadge Component
 *
 * Instagram-style verified badge (check-decagram) with Cofau gradient (red to orange).
 * Optional spinning animation for badge request modal.
 */
export default function CofauVerifiedBadge({ size = 16, animate = false }: CofauVerifiedBadgeProps) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animate) {
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [animate]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const badge = (
    <MaskedView
      maskElement={
        <MaterialCommunityIcons name="check-decagram" size={size} color="#000" />
      }
    >
      <LinearGradient
        colors={['#FF2E2E', '#FF7A18']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );

  if (animate) {
    return (
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        {badge}
      </Animated.View>
    );
  }

  return badge;
}
