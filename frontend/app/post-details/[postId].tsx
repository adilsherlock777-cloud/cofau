// app/post-details/[postId].tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  FlatList,
  Dimensions,
  Modal,
  Share,
  ScrollView,
  Animated,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import axios from "axios";
import { Image } from "expo-image";
import { Video } from "expo-av";
import { normalizeMediaUrl, normalizeProfilePicture } from "../../utils/imageUrlFix";

const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";
const API_URL = `${BACKEND}/api`;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

/* ---------------------------------------------------------
   🔥 UNIVERSAL URL NORMALIZER (FINAL VERSION)
----------------------------------------------------------*/
const normalizeUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  if (url.startsWith("http")) return url;

  let cleaned = url.trim();

  // remove duplicate slashes
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");

  // ensure leading slash
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;

  const finalUrl = `${BACKEND}${cleaned}`;
  return finalUrl;
};

/* ---------------------------------------------------------
   POST ITEM COMPONENT (Instagram-style full screen)
----------------------------------------------------------*/
function PostItem({ post, onPostPress, currentPostId, token, onCloseBottomSheetRef }: any) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.is_liked_by_user || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isSaved, setIsSaved] = useState(post.is_saved_by_user || false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [showDetails, setShowDetails] = useState(false); // Tap for Details state
  const [isMuted, setIsMuted] = useState(true); // Video mute state
  const videoRef = useRef(null);
  
  // Bottom sheet animation
  const bottomSheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const panY = useRef(0);

  const isVideo = (post.media_type || "").toLowerCase() === "video";
  const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
  const imageUrl = normalizeMediaUrl(post.image_url || post.media_url);
  const profilePic = normalizeProfilePicture(post.user_profile_picture);

  // Ensure we have a valid URL for display (fallback to normalizeUrl if needed)
  const getDisplayUrl = () => {
    if (isVideo) {
      return mediaUrl || normalizeUrl(post.media_url || post.image_url);
    }
    return imageUrl || mediaUrl || normalizeUrl(post.image_url || post.media_url);
  };

  const displayUrl = getDisplayUrl();

  // Pan responder for swipe up gesture on the media
  // Only responds to upward swipes from the very bottom (bottom 15% of screen)
  // This allows FlatList to handle vertical scrolling for changing posts
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to upward swipes from very bottom area (bottom 15%)
        // And only if bottom sheet is not already open
        const isFromBottom = gestureState.y0 > SCREEN_HEIGHT * 0.85;
        const isUpwardSwipe = gestureState.dy < -10;
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return !showBottomSheet && isFromBottom && isUpwardSwipe && isVerticalSwipe;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0 && !showBottomSheet) {
          // Swiping up
          const newY = Math.max(0, SCREEN_HEIGHT + gestureState.dy);
          bottomSheetY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -100 && !showBottomSheet) {
          // Swiped up significantly, show bottom sheet
          openBottomSheet();
        } else {
          // Snap back
          closeBottomSheet();
        }
      },
    })
  ).current;

  // Pan responder for bottom sheet to close it
  // Only handles downward swipes on the bottom sheet itself
  const bottomSheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes on the bottom sheet
        const isDownwardSwipe = gestureState.dy > 5;
        const isVerticalSwipe = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return showBottomSheet && isDownwardSwipe && isVerticalSwipe;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0 && showBottomSheet) {
          // Swiping down
          panY.current = gestureState.dy;
          bottomSheetY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 && showBottomSheet) {
          // Swiped down significantly, close bottom sheet
          closeBottomSheet();
        } else if (showBottomSheet) {
          // Snap back to open
          Animated.spring(bottomSheetY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const openBottomSheet = () => {
    setShowBottomSheet(true);
    Animated.spring(bottomSheetY, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const closeBottomSheet = useCallback(() => {
    Animated.timing(bottomSheetY, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowBottomSheet(false);
      panY.current = 0;
    });
  }, []);

  // Register close function with parent
  useEffect(() => {
    if (onCloseBottomSheetRef && post.id === currentPostId) {
      onCloseBottomSheetRef(closeBottomSheet);
    }
    return () => {
      if (onCloseBottomSheetRef) {
        onCloseBottomSheetRef(null);
      }
    };
  }, [onCloseBottomSheetRef, post.id, currentPostId, closeBottomSheet]);

  // Debug URLs for share modal
  useEffect(() => {
    if (showShareModal) {
      console.log("🔍 Share Modal Debug:");
      console.log("  Post ID:", post.id);
      console.log("  Is Video:", isVideo);
      console.log("  Original media_url:", post.media_url);
      console.log("  Original image_url:", post.image_url);
      console.log("  Normalized mediaUrl:", mediaUrl);
      console.log("  Normalized imageUrl:", imageUrl);
      console.log("  Display URL:", displayUrl);
    }
  }, [showShareModal, post.id, isVideo, mediaUrl, imageUrl, displayUrl]);

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, post.id]);

  // Close bottom sheet when post changes (user scrolled to different post)
  useEffect(() => {
    if (showBottomSheet) {
      closeBottomSheet();
    }
  }, [post.id]);

  const fetchComments = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts/${post.id}/comments`);
      const normalized = res.data.map((c: any) => ({
        ...c,
        profile_pic: normalizeProfilePicture(c.profile_pic),
      }));
      setComments(normalized);
    } catch (e) {
      console.log("❌ Comment fetch error", e);
    }
  };

  const handleLikeToggle = async () => {
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

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    setSubmittingComment(true);

    try {
      const formData = new FormData();
      formData.append("comment_text", commentText.trim());

      await axios.post(`${API_URL}/posts/${post.id}/comment`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setCommentText("");
      fetchComments();
    } catch (e) {
      Alert.alert("Error", "Unable to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTime = (timestamp: string | null | undefined): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleSharePost = async () => {
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
        console.log("Post shared successfully");
      } else if (result.action === Share.dismissedAction) {
        console.log("Share dismissed");
      }
    } catch (error) {
      console.error("❌ Error sharing post:", error);
      Alert.alert("Error", "Unable to share post. Please try again.");
    }
  };

  return (
    <View style={styles.postItem}>
      {/* FULL HEIGHT MEDIA - Instagram Style */}
      <View style={styles.fullScreenMediaContainer} {...panResponder.panHandlers}>
        {/* Fullscreen Reels-Style Media */}
        <TouchableOpacity 
          style={styles.fullScreenMediaContainer}
          activeOpacity={1}
          onPress={() => {
            if (isVideo) {
              setIsMuted(!isMuted);
            }
          }}
        >
          {isVideo ? (
            <>
              <Video
                ref={videoRef}
                source={{ uri: imageUrl || '' }}
                style={styles.fullScreenVideo}
                resizeMode="cover"
                shouldPlay={post.id === currentPostId}
                isLooping
                isMuted={isMuted}
                useNativeControls={false}
              />
              {/* Mute/Unmute Indicator */}
              <View style={styles.muteIndicatorReels}>
                <Ionicons 
                  name={isMuted ? "volume-mute" : "volume-high"} 
                  size={28} 
                  color="rgba(255,255,255,0.9)" 
                />
              </View>
            </>
          ) : (
            <Image
              source={{ uri: imageUrl || '' }}
              style={styles.fullScreenVideo}
              contentFit="cover"
            />
          )}
        </TouchableOpacity>

        {/* Tap for Details Button */}
        {!showDetails && (
          <TouchableOpacity 
            style={styles.tapForDetailsButton}
            onPress={() => setShowDetails(true)}
          >
            <Ionicons name="chevron-up" size={20} color="#333" />
            <Text style={styles.tapForDetailsText}>Tap for Details</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* BOTTOM SHEET MODAL */}
      {showBottomSheet && (
        <View style={styles.bottomSheetOverlay} pointerEvents="box-none">
          <View style={styles.bottomSheetBackdrop} pointerEvents="auto">
            <TouchableOpacity 
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeBottomSheet}
            />
          </View>
          <Animated.View
            style={[
              styles.bottomSheetContainer,
              {
                transform: [{ translateY: bottomSheetY }],
              },
            ]}
            pointerEvents="auto"
            {...bottomSheetPanResponder.panHandlers}
          >
            <View style={styles.bottomSheetHandle} />
            
            <ScrollView
              style={styles.bottomSheetScroll}
              showsVerticalScrollIndicator={false}
              bounces={true}
              nestedScrollEnabled={true}
            >
              {/* User Info */}
              <TouchableOpacity
                style={styles.bottomSheetUserRow}
                onPress={() => {
                  closeBottomSheet();
                  router.push(`/profile?userId=${post.user_id}`);
                }}
              >
                <UserAvatar
                  profilePicture={profilePic}
                  username={post.username}
                  level={post.user_level}
                  size={50}
                  showLevelBadge
                  style={{}}
                />
                <View style={styles.bottomSheetUserInfo}>
                  <Text style={styles.bottomSheetUsername}>{post.username}</Text>
                  <Text style={styles.bottomSheetTimestamp}>{formatTime(post.created_at)}</Text>
                </View>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.bottomSheetActions}>
                <TouchableOpacity 
                  style={styles.bottomSheetActionBtn}
                  onPress={handleLikeToggle}
                >
                  <Ionicons
                    name={isLiked ? "heart" : "heart-outline"}
                    size={28}
                    color={isLiked ? "#FF6B6B" : "#000"}
                  />
                  <Text style={styles.bottomSheetActionText}>{likesCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.bottomSheetActionBtn}
                  onPress={() => setShowComments(!showComments)}
                >
                  <Ionicons name="chatbubble-outline" size={26} color="#000" />
                  <Text style={styles.bottomSheetActionText}>{post.comments_count || comments.length}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.bottomSheetActionBtn}
                  onPress={() => {
                    closeBottomSheet();
                    setShowShareModal(true);
                  }}
                >
                  <Ionicons name="share-outline" size={26} color="#000" />
                  <Text style={styles.bottomSheetActionText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.bottomSheetActionBtn}
                  onPress={handleSaveToggle}
                >
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={26}
                    color={isSaved ? "#4dd0e1" : "#000"}
                  />
                  <Text style={styles.bottomSheetActionText}>Save</Text>
                </TouchableOpacity>
              </View>

              {/* Rating */}
              {post.rating && (
                <View style={styles.bottomSheetCard}>
                  <Text style={styles.bottomSheetCardLabel}>Ratings</Text>
                  <View style={styles.bottomSheetRatingRow}>
                    <Ionicons name="star" size={28} color="#FFD700" />
                    <Text style={styles.bottomSheetRatingText}>{post.rating}/10</Text>
                  </View>
                </View>
              )}

              {/* Review Text */}
              {post.review_text && (
                <View style={styles.bottomSheetCard}>
                  <Text style={styles.bottomSheetCardLabel}>Reviews</Text>
                  <View style={styles.bottomSheetReviewRow}>
                    <Ionicons name="bulb" size={24} color="#FF9500" />
                    <Text style={styles.bottomSheetReviewText}>{post.review_text}</Text>
                  </View>
                </View>
              )}

              {/* Location / Restaurant Name */}
              {post.location_name && (
                <View style={styles.bottomSheetCard}>
                  <Text style={styles.bottomSheetCardLabel}>Location</Text>
                  <TouchableOpacity
                    style={styles.bottomSheetLocationRow}
                    onPress={() => {
                      if (post.map_link) {
                        Linking.openURL(post.map_link);
                      } else if (post.location_name) {
                        const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
                        Linking.openURL(searchUrl);
                      }
                    }}
                  >
                    <Ionicons name="location" size={24} color="#FF3B30" />
                    <Text style={styles.bottomSheetLocationText}>{post.location_name}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Comments Section */}
              {showComments && (
                <View style={styles.bottomSheetCommentsSection}>
                  <Text style={styles.bottomSheetCommentsTitle}>
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
                          size={36}
                          level={c.level || 1}
                          style={{}}
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
                    />

                    <TouchableOpacity
                      style={[
                        styles.sendButton,
                        !commentText.trim() && { backgroundColor: "#ccc" },
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

              <View style={{ height: 60 }} />
            </ScrollView>
          </Animated.View>
        </View>
      )}

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

            {/* Post Image */}
            {displayUrl && (
              <View style={styles.sharePostImageContainer}>
                {isVideo ? (
                  <Video
                    source={{ uri: displayUrl || '' }}
                    style={styles.sharePostImage}
                    resizeMode={"cover" as any}
                    useNativeControls={false}
                    isLooping
                    shouldPlay={false}
                  />
                ) : (
                  <Image
                    source={{ uri: displayUrl || '' }}
                    style={styles.sharePostImage}
                    contentFit="cover"
                    transition={200}
                  />
                )}
              </View>
            )}

            {/* Post Details */}
            <View style={styles.sharePostDetails}>
              {/* Rating */}
              {post.rating ? (
                <View style={styles.shareDetailRow}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.shareDetailText}>{post.rating}/10</Text>
                </View>
              ) : null}

              {/* Location */}
              {post.location_name ? (
                <View style={styles.shareDetailRow}>
                  <Ionicons name="location" size={20} color="#FF3B30" />
                  <Text style={styles.shareDetailText}>{post.location_name}</Text>
                </View>
              ) : null}

              {/* Link */}
              <TouchableOpacity
                style={styles.shareDetailRow}
                onPress={() => {
                  const postUrl = `${BACKEND}/post/${post.id}`;
                  Linking.openURL(postUrl).catch((err) =>
                    console.error("Failed to open URL:", err)
                  );
                }}
              >
                <Ionicons name="link" size={20} color="#888" />
                <Text style={styles.shareLinkText}>
                  click on this link to view on Cofau
                </Text>
              </TouchableOpacity>
            </View>

            {/* Share Button */}
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
    </View>
  );
}

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { token, user } = useAuth() as any;

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [initialPostIndex, setInitialPostIndex] = useState(0);
  const [currentVisiblePost, setCurrentVisiblePost] = useState<any>(null);
  const flatListRef = useRef<FlatList<any> | null>(null);
  const bottomSheetCloseRef = useRef<(() => void) | null>(null);

  const LIMIT = 10;

  // Close bottom sheet when scrolling between posts
  const handleScrollBegin = useCallback(() => {
    if (bottomSheetCloseRef.current) {
      bottomSheetCloseRef.current();
      bottomSheetCloseRef.current = null;
    }
  }, []);

  // Track currently visible post
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const visiblePost = viewableItems[0].item;
      setCurrentVisiblePost(visiblePost);
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  /* ---------------------------------------------------------
     LOAD INITIAL POST AND FEED
  ----------------------------------------------------------*/
  useEffect(() => {
    if (postId && token) {
      loadInitialPost();
    }
  }, [postId, token]);

  const loadInitialPost = async () => {
    try {
      setLoading(true);

      // Fetch feed to find the post and get initial posts
      const res = await axios.get(`${API_URL}/feed?limit=50&skip=0`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Find the current post index
      const currentIndex = res.data.findIndex((p: any) => p.id === postId);

      if (currentIndex === -1) {
        Alert.alert("Error", "Post not found");
        router.back();
        return;
      }

      // Normalize all posts
      const normalized = res.data.map((p: any) => ({
        ...p,
        media_url: normalizeUrl(p.media_url),
        image_url: normalizeUrl(p.image_url || p.media_url),
        thumbnail_url: normalizeUrl(p.thumbnail_url),
        user_profile_picture: normalizeUrl(p.user_profile_picture),
      }));

      // Start from the current post
      const postsFromCurrent = normalized.slice(currentIndex);

      setPosts(postsFromCurrent);
      setInitialPostIndex(0);
      // Set the current visible post
      setCurrentVisiblePost(postsFromCurrent[0]);
      setSkip(postsFromCurrent.length);

      // Scroll to the current post after a short delay
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: 0,
          animated: false,
        });
      }, 100);
    } catch (e) {
      console.log("❌ Post fetch error", e);
      Alert.alert("Error", "Unable to load post");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------
     LOAD MORE POSTS (infinite scroll)
  ----------------------------------------------------------*/
  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);

      const res = await axios.get(`${API_URL}/feed?limit=${LIMIT}&skip=${skip}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.length === 0) {
        setHasMore(false);
        return;
      }

      // Normalize new posts
      const normalized = res.data.map((p: any) => ({
        ...p,
        media_url: normalizeUrl(p.media_url),
        image_url: normalizeUrl(p.image_url || p.media_url),
        thumbnail_url: normalizeUrl(p.thumbnail_url),
        user_profile_picture: normalizeUrl(p.user_profile_picture),
      }));

      // Filter out duplicates
      const existingIds = new Set(posts.map((p: any) => p.id));
      const newPosts = normalized.filter((p: any) => !existingIds.has(p.id));

      setPosts((prev) => [...prev, ...newPosts]);
      setSkip((prev) => prev + newPosts.length);

      if (newPosts.length < LIMIT) {
        setHasMore(false);
      }
    } catch (e) {
      console.log("❌ Load more error", e);
    } finally {
      setLoadingMore(false);
    }
  };

  /* ---------------------------------------------------------
     HANDLE POST PRESS (navigate to that post)
  ----------------------------------------------------------*/
  const handlePostPress = useCallback(
    (newPostId: string) => {
      if (newPostId === postId) return; // Already viewing this post

      // Always navigate to new post detail page
      router.push(`/post-details/${newPostId}`);
    },
    [postId, router]
  );

  /* ---------------------------------------------------------
     RENDER POST ITEM
  ----------------------------------------------------------*/
  const renderPostItem = useCallback(
    ({ item, index }: any) => {
      return (
        <PostItem
          post={item}
          onPostPress={handlePostPress}
          currentPostId={postId}
          token={token}
          onCloseBottomSheetRef={(closeFn: (() => void) | null) => {
            bottomSheetCloseRef.current = closeFn;
          }}
        />
      );
    },
    [postId, token, handlePostPress]
  );

  /* ---------------------------------------------------------
     RENDER FOOTER (loading indicator)
  ----------------------------------------------------------*/
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    );
  };

  /* ---------------------------------------------------------
     LOADING UI
  ----------------------------------------------------------*/
  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text>Loading post...</Text>
      </View>
    );

  if (posts.length === 0)
    return (
      <View style={styles.loadingContainer}>
        <Text>Post not found</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* HEADER OVERLAY WITH BACK BUTTON, USERNAME, AND 3-DOTS */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        
        {currentVisiblePost && (
          <>
            <Text style={styles.headerUsernameTop} numberOfLines={1}>
              {currentVisiblePost.username}
            </Text>
            
            <TouchableOpacity
              style={styles.headerOptionsButton}
              onPress={() => {
                // Open report menu for the current post
                Alert.alert("Post Options", "What would you like to do?", [
                  { 
                    text: "Report Post", 
                    style: "destructive",
                    onPress: () => {
                      Alert.alert("Report", "This post has been reported.");
                    }
                  },
                  { text: "Cancel", style: "cancel" }
                ]);
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={28} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* FLATLIST FOR CONTINUOUS SCROLLING */}
      <FlatList
        // @ts-ignore - FlatList ref type issue
        ref={flatListRef}
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={(item) => item.id}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        pagingEnabled={true}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        initialScrollIndex={initialPostIndex}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollBegin={handleScrollBegin}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data: any, index: number) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info: any) => {
          // Handle scroll to index failure
          const wait = new Promise((resolve) => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          });
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------
   STYLES
----------------------------------------------------------*/
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },

  header: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  
  headerBackButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 10,
    marginRight: 12,
  },
  
  headerUsernameTop: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  headerOptionsButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 10,
    marginLeft: 12,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },

  postItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },

  instagramScroll: {
    flex: 1,
  },

  // Full screen media container
  fullScreenMediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
    position: "relative",
  },

  // Instagram-style image viewer - centered with proper aspect ratio
  fullScreenImage: {
    width: "100%",
    height: "100%",
  },

  fullScreenVideo: {
    width: "100%",
    height: "100%",
  },

  // Header overlay on top of media
  headerOverlay: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },

  userRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },

  headerUsername: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
    color: "#fff",
  },

  // Swipe up indicator
  swipeUpIndicator: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },

  swipeUpText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  // Bottom Sheet Styles
  bottomSheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },

  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.85,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 10,
  },

  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#ddd",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },

  bottomSheetScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },

  bottomSheetUserRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginBottom: 16,
  },

  bottomSheetUserInfo: {
    marginLeft: 12,
    flex: 1,
  },

  bottomSheetUsername: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },

  bottomSheetTimestamp: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },

  bottomSheetActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginBottom: 20,
  },

  bottomSheetActionBtn: {
    alignItems: "center",
    paddingHorizontal: 16,
  },

  bottomSheetActionText: {
    marginTop: 6,
    fontSize: 12,
    color: "#333",
    fontWeight: "600",
  },

  bottomSheetCard: {
    marginBottom: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 16,
    padding: 16,
  },

  bottomSheetCardLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12,
  },

  bottomSheetRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
    padding: 16,
    borderRadius: 12,
  },

  bottomSheetRatingText: {
    marginLeft: 12,
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },

  bottomSheetReviewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF5E6",
    padding: 16,
    borderRadius: 12,
  },

  bottomSheetReviewText: {
    marginLeft: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#333",
    flex: 1,
  },

  bottomSheetLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF0F0",
    padding: 16,
    borderRadius: 12,
  },

  bottomSheetLocationText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    flex: 1,
  },

  bottomSheetCommentsSection: {
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },

  bottomSheetCommentsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#000",
  },

  noComments: {
    textAlign: "center",
    color: "#777",
    marginTop: 10,
    fontSize: 14,
  },

  commentItem: {
    flexDirection: "row",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },

  commentContent: {
    marginLeft: 10,
    flex: 1,
  },

  commentUsername: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  commentText: {
    marginTop: 4,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },

  commentTime: {
    marginTop: 4,
    fontSize: 12,
    color: "#999",
  },

  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: "#f0f0f0",
  },

  commentInput: {
    flex: 1,
    backgroundColor: "#f8f8f8",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 14,
  },

  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: "#4dd0e1",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  footerLoader: {
    padding: 20,
    alignItems: "center",
  },

  // Share Modal Styles
  shareModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  shareModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "90%",
    maxWidth: 400,
    padding: 20,
    alignItems: "center",
  },

  shareModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },

  shareModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },

  sharePostImageContainer: {
    width: "100%",
    height: 300,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#000",
  },

  sharePostImage: {
    width: "100%",
    height: "100%",
  },

  sharePostDetails: {
    width: "100%",
    marginBottom: 20,
  },

  shareDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
  },

  shareDetailText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },

  shareLinkText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#888",
    textDecorationLine: "underline",
  },

  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4dd0e1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    width: "100%",
  },

  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
