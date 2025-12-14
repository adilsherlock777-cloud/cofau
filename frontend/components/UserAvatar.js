import React, { useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LevelBadge from './LevelBadge';
import { normalizeProfilePicture } from '../utils/imageUrlFix';

export default function UserAvatar({
  profilePicture,
  username = '',
  size = 40,
  showLevelBadge = true,
  level,
  style,
}) {
  const fullUrl = normalizeProfilePicture(profilePicture);
  const [imageError, setImageError] = useState(false);

  const getInitials = () => {
    if (!username) return null;
    const parts = username.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials();

  const showFallback =
    !fullUrl ||
    fullUrl.includes("null") ||
    fullUrl.includes("undefined") ||
    fullUrl.endsWith("/profile_pictures/") ||
    imageError;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {!showFallback ? (
        <Image
          source={{ uri: fullUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          onError={() => setImageError(true)}
        />
      ) : (
        <View
          style={[
            styles.fallbackContainer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          {initials ? (
            <Text
              style={{
                fontSize: size * 0.4,
                fontWeight: '600',
                color: '#555',
              }}
            >
              {initials}
            </Text>
          ) : (
            <Ionicons name="person" size={size * 0.6} color="#777" />
          )}
        </View>
      )}

      {/* Level Badge - positioned at bottom-left */}
      {showLevelBadge && level && (
        <View style={styles.badgeContainer}>
          <LevelBadge level={level} size="small" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#E0E0E0',
  },
  fallbackContainer: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
});