import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapButton from './MapButton';
import { LinearGradient } from 'expo-linear-gradient';
import { likePost, unlikePost } from '../utils/api';

const formatTimestamp = (timestamp) => {
  const now = new Date();
  const postDate = new Date(timestamp);
  const diffInSeconds = Math.floor((now - postDate) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return postDate.toLocaleDateString();
};

export default function FeedCard({ post }) {
  const router = useRouter();
  
  // Debug: Log the media_url to see what we're receiving
  console.log('🎴 FeedCard received post with media_url:', post.media_url);
  console.log('🎴 Post data:', JSON.stringify(post, null, 2));

  const handleImagePress = () => {
    router.push('/post-details');
  };

  return (
    <View style={styles.card}>
      {/* User Info */}
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          {post.user_profile_picture ? (
            <Image source={{ uri: post.user_profile_picture }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarLetter}>
              {post.username ? post.username.charAt(0).toUpperCase() : 'U'}
            </Text>
          )}
        </View>
        <View style={styles.userTextContainer}>
          <Text style={styles.username}>{post.username}</Text>
          {post.created_at && (
            <Text style={styles.timestamp}>{formatTimestamp(post.created_at)}</Text>
          )}
        </View>
        {post.user_badge && (
          <View style={styles.badgeIcon}>
            <Text style={styles.badgeIconText}>🏆</Text>
          </View>
        )}
      </View>

      {/* Image Section */}
      <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9}>
        {post.media_url ? (
          <Image 
            source={{ uri: post.media_url }} 
            style={styles.postImage}
            resizeMode="cover"
            onError={(error) => {
              console.error('❌ Image failed to load:', post.media_url, error);
            }}
            onLoad={() => {
              console.log('✅ Image loaded successfully:', post.media_url);
            }}
          />
        ) : (
          <LinearGradient
            colors={['#66D9E8', '#F093FB', '#F5576C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.imageGradient}
          >
            <Text style={styles.photoText}>PHOTO</Text>
          </LinearGradient>
        )}
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
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userTextContainer: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  badgeIcon: {
    marginLeft: 8,
  },
  badgeIconText: {
    fontSize: 16,
  },
  postImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
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