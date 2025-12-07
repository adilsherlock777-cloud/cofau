import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  Modal,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import UserAvatar from './UserAvatar';
import axios from 'axios';
import { Image } from 'expo-image';
import { Video } from 'expo-av';
import { normalizeMediaUrl, normalizeProfilePicture } from '../utils/imageUrlFix';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  PanGestureHandler,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://backend.cofau.com';
const API_URL = `${BACKEND}/api`;

// Collapsed height (just the bottom bar)
const COLLAPSED_HEIGHT = 100;
// Expanded height (full screen minus safe area)
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.95;

interface PostBottomSheetProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
}

export default function PostBottomSheet({ visible, postId, onClose }: PostBottomSheetProps) {
  const router = useRouter();
  const { token } = useAuth() as { token: string | null };
  
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const videoRef = useRef<any>(null);

  // Animation values
  const translateY = useSharedValue(EXPANDED_HEIGHT);
  const isExpanded = useSharedValue(false);

  // Fetch post data
  useEffect(() => {
    if (visible && postId && token) {
      fetchPostDetails();
      // Start in collapsed state
      translateY.value = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;
      isExpanded.value = false;
    } else if (!visible) {
      // Reset when closed
      translateY.value = EXPANDED_HEIGHT;
      isExpanded.value = false;
      setPost(null);
      setComments([]);
      setCommentText('');
      setShowComments(false);
    }
  }, [visible, postId, token]);

  const fetchPostDetails = async () => {
    if (!postId || !token) return;

    setLoading(true);
    try {
      let postData;
      
      // Try single post endpoint first
      try {
        const res = await axios.get(`${API_URL}/posts/${postId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        postData = res.data;
      } catch (e) {
        // Fallback: fetch from feed and find the post
        const feedRes = await axios.get(`${API_URL}/feed?limit=100&skip=0`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const foundPost = feedRes.data.find((p: any) => p.id === postId);
        if (!foundPost) {
          throw new Error('Post not found');
        }
        postData = foundPost;
      }

      setPost(postData);
      setIsLiked(postData.is_liked_by_user || false);
      setLikesCount(postData.likes_count || 0);
      setIsSaved(postData.is_saved_by_user || false);

      // Keep collapsed - user can swipe up to expand
    } catch (error) {
      console.error('❌ Error fetching post:', error);
      Alert.alert('Error', 'Failed to load post');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const expandSheet = () => {
    translateY.value = withSpring(0, {
      damping: 20,
      stiffness: 90,
    });
    isExpanded.value = true;
  };

  const collapseSheet = () => {
    translateY.value = withSpring(EXPANDED_HEIGHT - COLLAPSED_HEIGHT, {
      damping: 20,
      stiffness: 90,
    });
    isExpanded.value = false;
  };

  const closeSheet = () => {
    translateY.value = withTiming(EXPANDED_HEIGHT, {
      duration: 300,
    });
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Gesture handler for swipe
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx: any) => {
      const newY = ctx.startY + event.translationY;
      // Prevent dragging above top or below bottom
      if (newY >= 0 && newY <= EXPANDED_HEIGHT - COLLAPSED_HEIGHT) {
        translateY.value = newY;
      }
    },
    onEnd: (event) => {
      const threshold = (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) / 2;
      const velocity = event.velocityY;

      if (velocity > 500 || translateY.value > threshold) {
        // Swipe down - collapse
        runOnJS(collapseSheet)();
      } else if (velocity < -500 || translateY.value < threshold) {
        // Swipe up - expand
        runOnJS(expandSheet)();
      } else {
        // Snap to nearest position
        if (translateY.value > threshold) {
          runOnJS(collapseSheet)();
        } else {
          runOnJS(expandSheet)();
        }
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const handleLikeToggle = async () => {
    if (!post || !token) return;

    const prevLiked = isLiked;
    const prevCount = likesCount;

    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      if (prevLiked) {
        await axios.delete(`${API_URL}/posts/${post.id}/like`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(
          `${API_URL}/posts/${post.id}/like`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (e) {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const handleSaveToggle = async () => {
    if (!post || !token) return;

    const prevSaved = isSaved;
    setIsSaved(!prevSaved);

    try {
      if (prevSaved) {
        await axios.delete(`${API_URL}/posts/${post.id}/save`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(
          `${API_URL}/posts/${post.id}/save`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (e) {
      setIsSaved(prevSaved);
    }
  };

  const fetchComments = async () => {
    if (!post || !token) return;

    try {
      const res = await axios.get(`${API_URL}/posts/${post.id}/comments`);
      const normalized = res.data.map((c: any) => ({
        ...c,
        profile_pic: normalizeProfilePicture(c.profile_pic),
      }));
      setComments(normalized);
    } catch (e) {
      console.log('❌ Comment fetch error', e);
    }
  };

  useEffect(() => {
    if (showComments && post) {
      fetchComments();
    }
  }, [showComments, post?.id]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !post || !token) return;

    setSubmittingComment(true);
    try {
      const formData = new FormData();
      formData.append('comment_text', commentText.trim());

      await axios.post(`${API_URL}/posts/${post.id}/comment`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setCommentText('');
      fetchComments();
    } catch (e) {
      Alert.alert('Error', 'Unable to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTime = (timestamp: string | null | undefined): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleSharePost = async () => {
    if (!post) return;

    try {
      const postUrl = `${BACKEND}/post/${post.id}`;
      const shareText = `${post.username} shared a post on Cofau!\n\n${post.review_text || ''}\n\nRating: ${post.rating}/10${post.location_name ? `\n📍 ${post.location_name}` : ''}\n\nView post: ${postUrl}`;

      const shareOptions = {
        message: shareText,
        url: postUrl,
        title: `Check out ${post.username}'s post on Cofau`,
      };

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        setShowShareModal(false);
      }
    } catch (error) {
      console.error('❌ Error sharing post:', error);
      Alert.alert('Error', 'Unable to share post. Please try again.');
    }
  };

  if (!visible) return null;

  const isVideo = post && (post.media_type || '').toLowerCase() === 'video';
  const mediaUrl = post ? normalizeMediaUrl(post.media_url || post.image_url) : null;
  const imageUrl = post ? normalizeMediaUrl(post.image_url || post.media_url) : null;
  const profilePic = post ? normalizeProfilePicture(post.user_profile_picture) : null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={closeSheet}
    >
      <GestureHandlerRootView style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeSheet}
        />
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={[styles.bottomSheet, animatedStyle]}>
            {/* Drag Handle */}
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4dd0e1" />
                <Text style={styles.loadingText}>Loading post...</Text>
              </View>
            ) : post ? (
              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Header with Follow Button */}
                <View style={styles.header}>
                  <TouchableOpacity
                    style={styles.headerUser}
                    onPress={() => {
                      closeSheet();
                      router.push(`/profile?userId=${post.user_id}`);
                    }}
                  >
                    <UserAvatar
                      profilePicture={profilePic}
                      username={post.username}
                      level={post.user_level}
                      size={40}
                      showLevelBadge
                    />
                    <Text style={styles.headerUsername}>{post.username}</Text>
                  </TouchableOpacity>
                  <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.followButton}>
                      <Text style={styles.followButtonText}>Follow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuButton}>
                      <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Media */}
                <View style={styles.mediaContainer}>
                  {isVideo ? (
                    <Video
                      ref={videoRef}
                      source={{ uri: mediaUrl || '' }}
                      style={styles.media}
                      resizeMode="cover"
                      useNativeControls
                      isLooping
                    />
                  ) : (
                    <Image
                      source={{ uri: imageUrl || mediaUrl || '' }}
                      style={styles.media}
                      contentFit="cover"
                    />
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleLikeToggle}>
                    <Ionicons
                      name={isLiked ? 'heart' : 'heart-outline'}
                      size={28}
                      color={isLiked ? '#FF6B6B' : '#000'}
                    />
                    <Text style={styles.actionText}>{likesCount}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      setShowComments(!showComments);
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={26} color="#000" />
                    <Text style={styles.actionText}>{post.comments_count || comments.length}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowShareModal(true)}
                  >
                    <Ionicons name="share-outline" size={26} color="#000" />
                    <Text style={styles.actionText}>{post.shares_count || 0}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton} onPress={handleSaveToggle}>
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={26}
                      color={isSaved ? '#4dd0e1' : '#000'}
                    />
                  </TouchableOpacity>
                </View>

                {/* Post Info Section - Instagram Style */}
                <View style={styles.postInfo}>
                  {/* Username and Caption */}
                  <View style={styles.captionContainer}>
                    <Text style={styles.caption}>
                      <Text style={styles.captionUsername}>{post.username}</Text>
                      {post.review_text && ` ${post.review_text}`}
                    </Text>
                  </View>

                  {/* Rating */}
                  {post.rating && (
                    <View style={styles.infoRow}>
                      <Ionicons name="star" size={18} color="#FFD700" />
                      <Text style={styles.infoText}>{post.rating}/10</Text>
                    </View>
                  )}

                  {/* Reviews */}
                  {post.review_text && post.rating && (
                    <View style={styles.infoRow}>
                      <Ionicons name="trophy" size={18} color="#FFD700" />
                      <Text style={styles.reviewText}>Must Visit Place with Good Ambience</Text>
                    </View>
                  )}

                  {/* Location */}
                  {post.location_name && (
                    <TouchableOpacity
                      style={styles.infoRow}
                      onPress={() => {
                        if (post.map_link) {
                          Linking.openURL(post.map_link);
                        } else if (post.location_name) {
                          const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
                          Linking.openURL(searchUrl);
                        }
                      }}
                    >
                      <Ionicons name="location" size={18} color="#FFD700" />
                      <Text style={styles.locationText}>{post.location_name}</Text>
                    </TouchableOpacity>
                  )}

                  {/* Timestamp */}
                  <Text style={styles.timestamp}>{formatTime(post.created_at)}</Text>
                </View>

                {/* Comments Section */}
                {showComments && (
                  <View style={styles.commentsSection}>
                    <Text style={styles.commentsTitle}>
                      Comments ({comments.length})
                    </Text>

                    {comments.length === 0 ? (
                      <Text style={styles.noComments}>No comments yet</Text>
                    ) : (
                      comments.map((c: any) => (
                        <View key={c.id} style={styles.commentItem}>
                          <UserAvatar
                            profilePicture={c.profile_pic}
                            username={c.username}
                            size={32}
                          />
                          <View style={styles.commentContent}>
                            <Text style={styles.commentUsername}>{c.username}</Text>
                            <Text style={styles.commentText}>{c.comment_text}</Text>
                            <Text style={styles.commentTime}>
                              {formatTime(c.created_at)}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}

                    {/* Comment Input */}
                    <View style={styles.commentInputContainer}>
                      <TextInput
                        value={commentText}
                        onChangeText={setCommentText}
                        placeholder="Add a comment…"
                        style={styles.commentInput}
                        multiline
                      />
                      <TouchableOpacity
                        style={[
                          styles.sendButton,
                          !commentText.trim() && { backgroundColor: '#ccc' },
                        ]}
                        disabled={!commentText.trim() || submittingComment}
                        onPress={handleSubmitComment}
                      >
                        {submittingComment ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="send" size={20} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            ) : null}
          </Animated.View>
        </PanGestureHandler>

        {/* Share Modal */}
        <Modal
          visible={showShareModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowShareModal(false)}
        >
          <View style={styles.shareModalOverlay}>
            <View style={styles.shareModalContent}>
              <View style={styles.shareModalHeader}>
                <Text style={styles.shareModalTitle}>Share Post</Text>
                <TouchableOpacity onPress={() => setShowShareModal(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              {mediaUrl && (
                <View style={styles.sharePostImageContainer}>
                  {isVideo ? (
                    <Video
                      source={{ uri: mediaUrl }}
                      style={styles.sharePostImage}
                      resizeMode="cover"
                      useNativeControls={false}
                      isLooping
                      shouldPlay={false}
                    />
                  ) : (
                    <Image
                      source={{ uri: imageUrl || mediaUrl }}
                      style={styles.sharePostImage}
                      contentFit="cover"
                    />
                  )}
                </View>
              )}

              <View style={styles.sharePostDetails}>
                {post?.rating && (
                  <View style={styles.shareDetailRow}>
                    <Ionicons name="star" size={20} color="#FFD700" />
                    <Text style={styles.shareDetailText}>-{post.rating}/10</Text>
                  </View>
                )}

                {post?.location_name && (
                  <View style={styles.shareDetailRow}>
                    <Ionicons name="location" size={20} color="#FF3B30" />
                    <Text style={styles.shareDetailText}>-{post.location_name}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleSharePost}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.shareButtonText}>Share Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: EXPANDED_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D0D0D0',
    borderRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerUsername: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  followButton: {
    backgroundColor: '#0095F6',
    paddingHorizontal: 24,
    paddingVertical: 6,
    borderRadius: 8,
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  menuButton: {
    padding: 4,
  },
  mediaContainer: {
    width: '100%',
    backgroundColor: '#000',
    aspectRatio: 1,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  postInfo: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  infoText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  reviewText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  locationText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  captionContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  captionUsername: {
    fontWeight: '600',
    color: '#000',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  commentsSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  noComments: {
    textAlign: 'center',
    color: '#777',
    marginTop: 10,
    paddingVertical: 20,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  commentContent: {
    marginLeft: 10,
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  commentText: {
    marginTop: 2,
    fontSize: 14,
    color: '#333',
  },
  commentTime: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: '#4dd0e1',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    padding: 20,
    alignItems: 'center',
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  sharePostImageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#000',
  },
  sharePostImage: {
    width: '100%',
    height: '100%',
  },
  sharePostDetails: {
    width: '100%',
    marginBottom: 20,
  },
  shareDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  shareDetailText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4dd0e1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    width: '100%',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

