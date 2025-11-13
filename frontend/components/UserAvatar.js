import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LevelBadge from './LevelBadge';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://cofau-app.preview.emergentagent.com';

export default function UserAvatar({
  profilePicture,
  username,
  size = 40,
  showLevelBadge = true,
  level,
  style,
}) {
  // Construct full URL if needed
  let imageUrl = profilePicture;
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `${BACKEND_URL}${imageUrl}`;
  }

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          defaultSource={require('../assets/icon.png')} // Fallback
        />
      ) : (
        <View
          style={[
            styles.defaultAvatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <Ionicons name="person" size={size * 0.6} color="#999" />
        </View>
      )}

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
  defaultAvatar: {
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
