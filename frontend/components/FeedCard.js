import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import MapButton from './MapButton';
import { LinearGradient } from 'expo-linear-gradient';

export default function FeedCard({ post }) {
  let router;
  let segments;
  
  try {
    router = useRouter();
    segments = useSegments();
  } catch (e) {
    // Router not ready yet
  }

  const handleImagePress = () => {
    try {
      if (router) {
        router.push('/post-details');
      }
    } catch (error) {
      console.log('Router not ready yet');
    }
  };

  return (
    <View style={styles.card}>
      {/* User Info */}
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color="#FFF" />
        </View>
        <Text style={styles.username}>{post.username}</Text>
      </View>

      {/* Image Section */}
      <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9}>
        <LinearGradient
          colors={['#66D9E8', '#F093FB', '#F5576C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.imageGradient}
        >
          <Text style={styles.photoText}>PHOTO</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Action Row */}
      <View style={styles.actionRow}>
        <View style={styles.actionItem}>
          <Ionicons name="heart-outline" size={24} color="#999" />
          <Text style={styles.actionText}>{post.likes}</Text>
        </View>
        <View style={styles.actionItem}>
          <Ionicons name="chatbubble-outline" size={22} color="#999" />
          <Text style={styles.actionText}>{post.comments}</Text>
        </View>
        <View style={styles.actionItem}>
          <Ionicons name="paper-plane-outline" size={22} color="#999" />
          <Text style={styles.actionText}>{post.shares}</Text>
        </View>
      </View>

      {/* Description */}
      <View style={styles.descriptionSection}>
        <Text style={styles.descriptionText}>
          <Text style={styles.boldUsername}>{post.username}</Text> {post.description}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color="#FFD700" />
          <Text style={styles.ratingText}>{post.rating}/10</Text>
          <Text style={styles.ratingLabel}>- {post.ratingLabel}</Text>
        </View>
      </View>

      {/* Map Button */}
      <MapButton
        restaurantName={post.location}
        mapsUrl={post.mapsUrl}
      />

      {/* Popular Photos */}
      {post.popularPhotos && (
        <View style={styles.popularPhotos}>
          {post.popularPhotos.map((photo, index) => (
            <LinearGradient
              key={index}
              colors={['#66D9E8', '#F093FB', '#F5576C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.thumbnail}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#66D9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  username: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  imageGradient: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 4,
  },
  actionRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  descriptionSection: {
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  boldUsername: {
    fontWeight: 'bold',
    color: '#333',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
  },
  popularPhotos: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  thumbnail: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
});