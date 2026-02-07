import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from './UserAvatar';
import { normalizeMediaUrl, normalizeProfilePicture } from '../utils/imageUrlFix';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * ShareablePostCard - Renders a post in Instagram story format for sharing
 * This component is designed to be captured as an image using react-native-view-shot
 */
export default function ShareablePostCard({ post, appName = "Cofau" }) {
  const mediaUrl = normalizeMediaUrl(post.media_url);
  const dpUrl = normalizeProfilePicture(
    post.user_profile_picture ||
    post.profile_picture ||
    post.user_profile_pic
  );

  // Format date
  const getTimeAgo = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return "";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header - Similar to Instagram Story */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <UserAvatar
            profilePicture={dpUrl}
            username={post.username}
            size={40}
            level={post.user_level}
            showLevelBadge={false}
            style={{}}
          />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{post.username}</Text>
            <Text style={styles.timeAgo}>{getTimeAgo(post.created_at)}</Text>
          </View>
        </View>
        <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
      </View>

      {/* Main Content Card */}
      <View style={styles.contentCard}>
        {/* Location/Business Name Header */}
        {post.location_name && (
          <View style={styles.locationHeader}>
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={20} color="#4dd0e1" />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationName} numberOfLines={1}>
                {post.location_name}
              </Text>
              <Text style={styles.appBranding}>{appName}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={20} color="#999" />
          </View>
        )}

        {/* Post Image */}
        {mediaUrl && (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.postImage}
            resizeMode="cover"
          />
        )}

        {/* Post Content */}
        <View style={styles.contentBody}>
          {/* Rating */}
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={18} color="#FFD700" />
            <Text style={styles.ratingText}>{post.rating}/10</Text>
            <Text style={styles.ratingLabel}>
              {post.ratingLabel || 'Review'}
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.description} numberOfLines={3}>
            {post.description}
          </Text>

          {/* Read More Button */}
          <Text style={styles.readMore}>Read more</Text>

          {/* Likes Count */}
          <View style={styles.likesContainer}>
            <Ionicons name="heart" size={16} color="#FF6B6B" />
            <Text style={styles.likesText}>{post.likes || 0}</Text>
          </View>
        </View>
      </View>

      {/* Reply Button at Bottom */}
      <View style={styles.replyContainer}>
        <View style={styles.replyButton}>
          <Text style={styles.replyText}>Reply</Text>
        </View>
        <Ionicons name="heart-outline" size={28} color="#FFF" />
      </View>

      {/* Branding Footer */}
      <View style={styles.brandingFooter}>
        <Text style={styles.brandingText}>View on {appName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.78, // 16:9 aspect ratio for story
    backgroundColor: '#1a1a1a',
    padding: 16,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: 10,
  },
  username: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  timeAgo: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  contentCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 20,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 10,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  appBranding: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  postImage: {
    width: '100%',
    height: 320,
  },
  contentBody: {
    padding: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginLeft: 4,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  readMore: {
    fontSize: 14,
    color: '#4dd0e1',
    fontWeight: '600',
    marginBottom: 12,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likesText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
    fontWeight: '600',
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  replyButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 12,
  },
  replyText: {
    color: '#FFF',
    fontSize: 14,
  },
  brandingFooter: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  brandingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
});
