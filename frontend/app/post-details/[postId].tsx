import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import LevelBadge from '../../components/LevelBadge';
import UserAvatar from '../../components/UserAvatar';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://foodsocial-app.preview.emergentagent.com/api';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://foodsocial-app.preview.emergentagent.com';

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { token, user } = useAuth();
  const scrollViewRef = useRef(null);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    if (postId && token) {
      fetchPostDetails();
      fetchComments();
    }
  }, [postId, token]);

  const fetchPostDetails = async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching post details for:', postId);
      
      // Get post from feed endpoint (since there's no dedicated post details endpoint)
      const response = await axios.get(`${API_URL}/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const foundPost = response.data.find((p) => p.id === postId);
      
      if (foundPost) {
        // Process image URL
        let fullImageUrl = foundPost.image_url || foundPost.media_url;
        if (fullImageUrl && !fullImageUrl.startsWith('http')) {
          fullImageUrl = `${BACKEND_URL}${fullImageUrl.startsWith('/') ? fullImageUrl : '/' + fullImageUrl}`;
        }

        setPost({ ...foundPost, full_image_url: fullImageUrl });
        setIsLiked(foundPost.is_liked_by_user || foundPost.is_liked || false);
        setLikesCount(foundPost.likes_count || 0);
      } else {
        Alert.alert('Error', 'Post not found');
        router.back();
      }
      
      setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching post:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load post');
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${API_URL}/posts/${postId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('❌ Error fetching comments:', error);
    }
  };

  const handleLikeToggle = async () => {
    const previousLiked = isLiked;
    const previousCount = likesCount;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    try {
      if (isLiked) {
        await axios.delete(`${API_URL}/posts/${postId}/like`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/posts/${postId}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error('❌ Error toggling like:', error);
      // Revert on error
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const formData = new FormData();
      formData.append('comment_text', commentText.trim());

      await axios.post(`${API_URL}/posts/${postId}/comment`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setCommentText('');
      fetchComments(); // Refresh comments
      
      if (Platform.OS === 'web') {
        window.alert('Comment added! 💬');
      } else {
        Alert.alert('Success', 'Comment added!');
      }
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareMessage = `Check out this post on Cofau!\n\n${post.description || ''}\n\n${post.full_image_url || ''}`;
      
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: 'Cofau Post',
            text: shareMessage,
            url: post.full_image_url,
          });
        } else {
          // Fallback: copy to clipboard
          navigator.clipboard.writeText(shareMessage);
          window.alert('Link copied to clipboard!');
        }
      } else {
        await Share.share({
          message: shareMessage,
          url: post.full_image_url,
        });
      }
    } catch (error) {
      console.log('Share cancelled or error:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getRatingLabel = (rating) => {
    if (rating >= 9) return 'Exceptional';
    if (rating >= 7) return 'Great';
    if (rating >= 5) return 'Good';
    if (rating >= 3) return 'Average';
    return 'Poor';
  };

  const extractLocationFromMapLink = (mapLink) => {
    if (!mapLink) return 'Location not specified';
    try {
      const match = mapLink.match(/q=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1].replace(/\+/g, ' '));
      }
    } catch (e) {
      console.error('Error parsing location:', e);
    }
    return 'View on map';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Post not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.headerUser}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
        >
          <UserAvatar
            profilePicture={post.user_profile_picture}
            username={post.username}
            size={36}
            level={post.user_level}
            showLevelBadge={true}
            style={{ marginRight: 12 }}
          />
          <Text style={styles.headerUsername}>{post.username}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Post Image */}
        <View style={styles.imageContainer}>
          {post.full_image_url ? (
            <Image
              source={{ uri: post.full_image_url }}
              style={styles.postImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImagePlaceholder}>
              <Ionicons name="image-outline" size={80} color="#CCC" />
            </View>
          )}
        </View>

        {/* Post Information */}
        <View style={styles.postInfo}>
          {/* User Info Row */}
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => router.push(`/profile?userId=${post.user_id}`)}
          >
            <View style={styles.userAvatarContainer}>
              <View style={styles.userAvatar}>
                {post.user_profile_picture ? (
                  <Image source={{ uri: post.user_profile_picture }} style={styles.userAvatarImage} />
                ) : (
                  <Text style={styles.userAvatarLetter}>
                    {post.username ? post.username.charAt(0).toUpperCase() : 'U'}
                  </Text>
                )}
              </View>
              {post.user_level && <LevelBadge level={post.user_level} size="small" />}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.username}>{post.username}</Text>
              <Text style={styles.timestamp}>{formatTimestamp(post.created_at)}</Text>
            </View>
          </TouchableOpacity>

          {/* Caption */}
          {post.review_text && (
            <Text style={styles.caption}>{post.review_text}</Text>
          )}

          {/* Rating */}
          {post.rating && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={18} color="#FFD700" />
              <Text style={styles.ratingText}>
                {post.rating}/10 — {getRatingLabel(post.rating)}
              </Text>
            </View>
          )}

          {/* Location */}
          {post.map_link && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={18} color="#666" />
              <Text style={styles.locationText}>
                {extractLocationFromMapLink(post.map_link)}
              </Text>
            </View>
          )}
        </View>

        {/* Interaction Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLikeToggle}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={26}
              color={isLiked ? '#FF6B6B' : '#000'}
            />
            <Text style={styles.actionText}>{likesCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#000" />
            <Text style={styles.actionText}>{comments.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
          
          {comments.length === 0 ? (
            <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                <TouchableOpacity
                  style={styles.commentAvatarContainer}
                  onPress={() => router.push(`/profile?userId=${comment.user_id}`)}
                >
                  <View style={styles.commentAvatar}>
                    {comment.profile_pic ? (
                      <Image source={{ uri: comment.profile_pic }} style={styles.commentAvatarImage} />
                    ) : (
                      <Text style={styles.commentAvatarLetter}>
                        {comment.username ? comment.username.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    )}
                  </View>
                  {comment.level && <LevelBadge level={comment.level} size="small" />}
                </TouchableOpacity>
                
                <View style={styles.commentContent}>
                  <TouchableOpacity onPress={() => router.push(`/profile?userId=${comment.user_id}`)}>
                    <Text style={styles.commentUsername}>{comment.username}</Text>
                  </TouchableOpacity>
                  <Text style={styles.commentText}>{comment.comment_text}</Text>
                  <Text style={styles.commentTime}>{formatTimestamp(comment.created_at)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Spacing for input bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add Comment Input Bar */}
      <View style={styles.commentInputContainer}>
        <View style={styles.currentUserAvatar}>
          {user?.profile_picture ? (
            <Image source={{ uri: user.profile_picture }} style={styles.currentUserAvatarImage} />
          ) : (
            <Text style={styles.currentUserAvatarLetter}>
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </Text>
          )}
        </View>
        
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor="#999"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        
        <TouchableOpacity
          style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
          onPress={handleSubmitComment}
          disabled={submittingComment || !commentText.trim()}
        >
          {submittingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },

  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },

  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4dd0e1',
    borderRadius: 8,
  },

  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },

  backBtn: {
    marginRight: 16,
  },

  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  headerAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },

  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#66D9E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  headerAvatarLetter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },

  headerUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  scrollView: {
    flex: 1,
  },

  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F0F0F0',
  },

  postImage: {
    width: '100%',
    height: '100%',
  },

  noImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  postInfo: {
    padding: 16,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  userAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },

  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#66D9E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  userAvatarLetter: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  userInfo: {
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

  caption: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },

  actionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
    fontWeight: '600',
  },

  commentsSection: {
    padding: 16,
  },

  commentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },

  noCommentsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },

  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  commentAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },

  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#66D9E8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  commentAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  commentAvatarLetter: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },

  commentContent: {
    flex: 1,
  },

  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },

  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },

  commentTime: {
    fontSize: 12,
    color: '#999',
  },

  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },

  currentUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#66D9E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  currentUserAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  currentUserAvatarLetter: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },

  commentInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 12,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4dd0e1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
});
