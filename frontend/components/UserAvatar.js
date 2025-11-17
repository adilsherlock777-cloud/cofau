import React, { useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LevelBadge from './LevelBadge';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://backend.cofau.com';

/* 
  🔥 UNIVERSAL URL FIXER
  Handles:
  - profile_picture
  - profile_picture_url
  - user_profile_picture
  - profile_pic (comments)
  - null / empty
*/
const normalizeDP = (input) => {
  if (!input) return null;

  // sometimes backend sends nested objects => { profile_picture: "xxx" }
  if (typeof input === "object") {
    input =
      input.profile_picture ||
      input.user_profile_picture ||
      input.profile_pic ||
      input.profile_picture_url ||
      null;
  }

  if (!input) return null;

  if (input.startsWith("http")) return input;

  if (!input.startsWith("/")) return `${BACKEND_URL}/${input}`;

  return `${BACKEND_URL}${input}`;
};

export default function UserAvatar({
  profilePicture,
  username = '',
  size = 40,
  showLevelBadge = true,
  level,
  style,
}) {
  // 💥 FIX: normalize all incoming DP values
  const fullUrl = normalizeDP(profilePicture);

  const [imageError, setImageError] = useState(false);

  const getInitials = () => {
    if (!username) return null;
    const parts = username.trim().split(' ');
    if (parts.length === 1) return parts[0][0]?.toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials();

  const showFallback = !fullUrl || imageError;

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

      {/* LEVEL BADGE */}
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
    bottom: 0,
    right: 0,
  },
});
