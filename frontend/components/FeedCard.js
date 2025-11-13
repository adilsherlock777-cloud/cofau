import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapButton from './MapButton';
import { LinearGradient } from 'expo-linear-gradient';
import { likePost, unlikePost } from '../utils/api';
import UserAvatar from './UserAvatar';

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

export default function FeedCard({ post, onLikeUpdate }) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [isLiking, setIsLiking] = useState(false);

  const handleImagePress = () => {
    router.push(`/post-details/${post.id}`);
  };

  const handleLike = async () => {
    if (isLiking) return; // Prevent multiple clicks
    
    // Optimistic update
    const previousIsLiked = isLiked;
    const previousLikesCount = likesCount;
    
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
    setIsLiking(true);

    try {
      if (isLiked) {
        await unlikePost(post.id);
        console.log('✅ Post unliked');
      } else {
        await likePost(post.id);
        console.log('✅ Post liked');
      }
      
      // Notify parent component to refresh feed if needed
      if (onLikeUpdate) {
        onLikeUpdate(post.id, !isLiked);
      }
    } catch (error) {
      console.error('❌ Error toggling like:', error);
      // Revert optimistic update on error
      setIsLiked(previousIsLiked);
      setLikesCount(previousLikesCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleCommentPress = () => {
    router.push(`/comments/${post.id}`);
  };

  return (
    <View style={styles.card}>
      {/* User Info */}
      <View style={styles.userHeader}>
        <TouchableOpacity
          style={styles.userInfoTouchable}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {post.user_profile_picture ? (
                <Image source={{ uri: post.user_profile_picture }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarLetter}>
                  {post.username ? post.username.charAt(0).toUpperCase() : 'U'}
                </Text>
              )}
            </View>
            {/* Level Badge on Avatar */}
            {post.user_level && (
              <LevelBadge level={post.user_level} size="small" />
            )}
          </View>
          <View style={styles.userTextContainer}>
            <Text style={styles.username}>{post.username}</Text>
            {post.created_at && (
              <Text style={styles.timestamp}>{formatTimestamp(post.created_at)}</Text>
            )}
          </View>
        </TouchableOpacity>
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
            source={{ 
              uri: post.media_url,
              cache: 'reload' // Force fresh load to bypass any caching issues
            }} 
            style={styles.postImage}
            resizeMode="cover"
            onError={(error) => {
              console.error('❌ Image failed to load:', post.media_url, error.nativeEvent);
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
        <TouchableOpacity 
          style={styles.actionItem} 
          onPress={handleLike}
          disabled={isLiking}
        >
          <Ionicons 
            name={isLiked ? "heart" : "heart-outline"} 
            size={24} 
            color={isLiked ? "#FF6B6B" : "#999"} 
          />
          <Text style={[styles.actionText, isLiked && styles.likedText]}>
            {likesCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionItem}
          onPress={handleCommentPress}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#999" />
          <Text style={styles.actionText}>{post.comments || 0}</Text>
        </TouchableOpacity>
        <View style={styles.actionItem}>
          <Ionicons name="paper-plane-outline" size={22} color="#999" />
          <Text style={styles.actionText}>{post.shares || 0}</Text>
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
  userInfoTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#66D9E8',
    alignItems: 'center',
    justifyContent: 'center',
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
  likedText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
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