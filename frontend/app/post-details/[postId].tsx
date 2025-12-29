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
  ScrollView,
  Platform,
  SafeAreaView,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import SharePreviewModal from "../../components/SharePreviewModal";
import ReportModal from "../../components/ReportModal";
import { followUser, unfollowUser } from "../../utils/api";
import axios from "axios";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalizeMediaUrl, normalizeProfilePicture } from "../../utils/imageUrlFix";

const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${BACKEND}/api`;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

/* ---------------------------------------------------------
   🔥 UNIVERSAL URL NORMALIZER
----------------------------------------------------------*/
const normalizeUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  let cleaned = url.trim();
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return `${BACKEND}${cleaned}`;
};

/* ---------------------------------------------------------
   🔥 GRADIENT ICON COMPONENTS (Cofau Theme)
----------------------------------------------------------*/
const GradientHeart = ({ size = 18 }) => (
  <MaskedView
    maskElement={
      <View style={{ backgroundColor: 'transparent' }}>
        <Ionicons name="heart" size={size} color="#000" />
      </View>
    }
  >
    <LinearGradient
      colors={["#E94A37", "#F2CF68", "#1B7C82"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

const GradientBookmark = ({ size = 18 }) => (
  <MaskedView
    maskElement={
      <View style={{ backgroundColor: 'transparent' }}>
        <Ionicons name="bookmark" size={size} color="#000" />
      </View>
    }
  >
    <LinearGradient
      colors={["#E94A37", "#F2CF68", "#1B7C82"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

/* ---------------------------------------------------------
   POST ITEM COMPONENT
----------------------------------------------------------*/
function PostItem({ post, currentPostId, token, bottomInset }: any) {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [isLiked, setIsLiked] = useState(post.is_liked_by_user || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isSaved, setIsSaved] = useState(post.is_saved_by_user || false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isFollowing, setIsFollowing] = useState(post.is_following || false);
  const [followLoading, setFollowLoading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);
  
  // Update isFollowing state when post data changes
  useEffect(() => {
    setIsFollowing(post.is_following || false);
  }, [post.is_following]);
  
  // Check if this is the current user's own post
  const isOwnPost = user?.id === post.user_id;

  // Pan responder for swipe down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 10) {
          setShowDetails(false);
        }
      },
    })
  ).current;

  const isVideo = (post.media_type || "").toLowerCase() === "video";
  const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
  const imageUrl = normalizeMediaUrl(post.image_url || post.media_url);
  const profilePic = normalizeProfilePicture(post.user_profile_picture);

  const getDisplayUrl = () => {
    if (isVideo) {
      return mediaUrl || normalizeUrl(post.media_url || post.image_url);
    }
    return imageUrl || mediaUrl || normalizeUrl(post.image_url || post.media_url);
  };

  const displayUrl = getDisplayUrl();

  // Calculate bottom nav height based on safe area
  const BOTTOM_NAV_HEIGHT = 130;

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, post.id]);

  // Control video playback based on whether this post is currently visible
  const shouldPlay = isVideo && post.id === currentPostId;

  useEffect(() => {
    if (!isVideo || !videoRef.current) return;

    const controlVideo = async () => {
      try {
        const status = await (videoRef.current as any).getStatusAsync();

        if (shouldPlay) {
          // Play video if it should be playing
          if (status.isLoaded && !status.isPlaying) {
            await (videoRef.current as any).playAsync();
          }
        } else {
          // FULLY STOP video when not visible - pause, stop audio, and reset position
          if (status.isLoaded) {
            try {
              // First pause the video
              if (status.isPlaying) {
                await (videoRef.current as any).pauseAsync();
              }
              // Reset video position to beginning to stop audio completely
              await (videoRef.current as any).setPositionAsync(0);
            } catch (err) {
              console.log("Video stop error:", err);
            }
          }
        }
      } catch (error: any) {
        console.error("❌ Error controlling video:", error);
      }
    };

    const timer = setTimeout(() => {
      controlVideo();
    }, 100);

    return () => {
      clearTimeout(timer);
      // Cleanup: Ensure video is stopped when component unmounts or shouldPlay changes
      if (videoRef.current && !shouldPlay) {
        (videoRef.current as any).pauseAsync().catch(() => {});
        (videoRef.current as any).setPositionAsync(0).catch(() => {});
      }
    };
  }, [shouldPlay, isVideo, videoLoaded]);

  // Cleanup: Ensure video is fully stopped when component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current && isVideo) {
        // Stop video completely on unmount
        (videoRef.current as any).pauseAsync().catch(() => {});
        (videoRef.current as any).setPositionAsync(0).catch(() => {});
      }
    };
  }, [isVideo]);

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
        await axios.post(`${API_URL}/posts/${post.id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
        await axios.post(`${API_URL}/posts/${post.id}/save`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      setIsSaved(prevSaved);
    }
  };

  const handleFollowToggle = async () => {
    if (!post.user_id || isOwnPost || followLoading) return;
    
    // Show alert when following
    if (!isFollowing) {
      Alert.alert(
        "Follow User",
        `Do you want to follow ${post.username || "this user"}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {},
          },
          {
            text: "Follow",
            onPress: async () => {
              setFollowLoading(true);
              const previousFollowState = isFollowing;
              setIsFollowing(true);

              try {
                await followUser(post.user_id);
                Alert.alert("Success", `You are now following ${post.username || "this user"}`);
              } catch (error) {
                console.error("Error following user:", error);
                setIsFollowing(previousFollowState);
                Alert.alert("Error", "Failed to follow user. Please try again.");
              } finally {
                setFollowLoading(false);
              }
            },
          },
        ]
      );
    } else {
      // Unfollow without alert (less intrusive)
      setFollowLoading(true);
      const previousFollowState = isFollowing;
      setIsFollowing(false);

      try {
        await unfollowUser(post.user_id);
      } catch (error) {
        console.error("Error unfollowing user:", error);
        setIsFollowing(previousFollowState);
        Alert.alert("Error", "Failed to unfollow user. Please try again.");
      } finally {
        setFollowLoading(false);
      }
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

  return (
    <View style={styles.postItem}>
      {/* MEDIA CONTAINER */}
      <View style={[
  styles.responsiveMediaContainer,
  showDetails && styles.mediaContainerShrunk
]}>
        <TouchableOpacity 
          style={styles.mediaWrapper}
          activeOpacity={1}
          onPress={() => {
            if (isVideo) {
              setIsMuted(!isMuted);
            }
          }}
        >
          {isVideo ? (
            <>
              {!videoError ? (
                <Video
                  ref={videoRef}
                  source={{
                    uri: mediaUrl || displayUrl || '',
                    // iOS requires headers for proper video loading
                    headers: {
                      'Accept': 'video/mp4, video/quicktime, video/*',
                      'User-Agent': 'Cofau/1.0',
                    }
                  }}
                  style={styles.responsiveMedia}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={shouldPlay}
                  isLooping
                  isMuted={isMuted}
                  useNativeControls={false}
                  allowsExternalPlayback={false}
                  playInSilentModeIOS={true}
                  // iOS-specific props for better compatibility
                  usePoster={false}
                  posterSource={null}
                  onLoad={(status: any) => {
                    console.log("✅ Video loaded in post details", status);
                    // Only update state if it changed to prevent flickering
                    if (!videoLoaded) {
                      setVideoLoaded(true);
                    }
                    if (videoError) {
                      setVideoError(false);
                    }
                    // Ensure video plays after load (iOS needs explicit play)
                    if (videoRef.current && shouldPlay) {
                      setTimeout(async () => {
                        try {
                          const currentStatus = await (videoRef.current as any).getStatusAsync();
                          if (currentStatus.isLoaded && !currentStatus.isPlaying && shouldPlay) {
                            // iOS needs explicit play call
                            await (videoRef.current as any).playAsync();
                            // Ensure it's actually playing
                            const afterPlayStatus = await (videoRef.current as any).getStatusAsync();
                            if (!afterPlayStatus.isPlaying && shouldPlay) {
                              // Retry play if it didn't start (iOS sometimes needs this)
                              setTimeout(async () => {
                                try {
                                  await (videoRef.current as any).playAsync();
                                } catch (retryErr) {
                                  console.log("Video play retry error in post details:", retryErr);
                                }
                              }, 300);
                            }
                          }
                        } catch (err) {
                          console.log("Auto-play error in post details:", err);
                        }
                      }, 300); // Increased delay for iOS
                    }
                  }}
                  onError={(error: any) => {
                    console.error("❌ Video error in post details:", error);
                    console.error("❌ Video URL:", mediaUrl || displayUrl);
                    console.error("❌ Error details:", JSON.stringify(error, null, 2));
                    if (!videoError) {
                      setVideoError(true);
                    }
                    if (videoLoaded) {
                      setVideoLoaded(false);
                    }
                    // Try to reload video on error (iOS sometimes needs this)
                    if (videoRef.current) {
                      setTimeout(async () => {
                        try {
                          await (videoRef.current as any).unloadAsync();
                          await (videoRef.current as any).loadAsync({
                            uri: mediaUrl || displayUrl || '',
                            headers: {
                              'Accept': 'video/mp4, video/quicktime, video/*',
                              'User-Agent': 'Cofau/1.0',
                            }
                          });
                          if (shouldPlay) {
                            await (videoRef.current as any).playAsync();
                          }
                        } catch (reloadErr) {
                          console.error("Reload error in post details:", reloadErr);
                        }
                      }, 1000);
                    }
                  }}
                  onLoadStart={() => {
                    console.log("📹 Video loading started in post details:", mediaUrl || displayUrl);
                    // Don't reset videoLoaded here to prevent flickering
                    // Only set error to false if it was true
                    if (videoError) {
                      setVideoError(false);
                    }
                  }}
                  onPlaybackStatusUpdate={(status: any) => {
                    // Ensure video stops if shouldPlay becomes false
                    if (!shouldPlay && status.isLoaded && status.isPlaying && videoRef.current) {
                      (videoRef.current as any).pauseAsync().catch(() => {});
                      (videoRef.current as any).setPositionAsync(0).catch(() => {});
                    }
                    // Only attempt to play if video is loaded and should play
                    if (status.isLoaded && !status.isPlaying && shouldPlay && videoLoaded) {
                      (videoRef.current as any)?.playAsync().catch((err: any) => {
                        // Silently handle - don't log to prevent spam
                      });
                    }
                  }}
                  progressUpdateIntervalMillis={1000}
                />
              ) : (
                <View style={styles.videoErrorContainer}>
                  <Ionicons name="videocam-outline" size={40} color="#999" />
                  <Text style={styles.videoErrorText}>Unable to load video</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      setVideoError(false);
                      if (videoRef.current) {
                        (videoRef.current as any)?.reloadAsync?.().catch(console.error);
                      }
                    }}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!videoError && (
                <View style={styles.muteIndicatorReels}>
                  <Ionicons 
                    name={isMuted ? "volume-mute" : "volume-high"} 
                    size={24} 
                    color="rgba(255,255,255,0.9)" 
                  />
                </View>
              )}
            </>
          ) : (
            <Image
              source={{ uri: imageUrl || displayUrl || '' }}
              style={styles.responsiveMedia}
              contentFit="contain"
            />
          )}
        </TouchableOpacity>

        {/* User Info at Top with Back Button */}
        {!showDetails && (
          <View style={styles.topUserInfoBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.topUserRow}
              onPress={() => router.push(`/profile?userId=${post.user_id}`)}
            >
              <UserAvatar
                profilePicture={profilePic}
                username={post.username}
                level={post.user_level}
                size={44}
                showLevelBadge
                style={{}}
              />
              <View style={styles.topUserDetails}>
                <Text style={styles.topUsername}>{post.username}</Text>
                <Text style={styles.topTimestamp}>{formatTime(post.created_at)}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.topHeaderRight}>
              {/* Follow Button - Only show if not following and not own post */}
              {!isOwnPost && !isFollowing && (
                <TouchableOpacity
                  style={styles.topFollowButton}
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                >
                  <Text style={styles.topFollowButtonText}>
                    {followLoading ? "..." : "Follow"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Three Dots Menu */}
              <TouchableOpacity
                style={styles.optionsButton}
                onPress={() => setShowOptionsMenu(!showOptionsMenu)}
              >
                <Ionicons name="ellipsis-vertical" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Options Menu Modal */}
        {showOptionsMenu && (
          <>
            <TouchableOpacity
              style={styles.optionsMenuBackdrop}
              activeOpacity={1}
              onPress={() => setShowOptionsMenu(false)}
            />
            <View style={styles.optionsMenuOverlay}>
              <TouchableOpacity
                style={styles.optionsMenuItem}
                onPress={() => {
                  setShowOptionsMenu(false);
                  setShowReportModal(true);
                }}
              >
                <Ionicons name="flag-outline" size={20} color="#E94A37" />
                <Text style={styles.optionsMenuText}>Report Post</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Report Modal */}
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          postId={post.id}
        />

        {/* Glass Bottom Overlay - Evenly Distributed Items */}
        {!showDetails && (
          <TouchableOpacity 
            style={[styles.glassBottomOverlay, { bottom: BOTTOM_NAV_HEIGHT + 10 }]}
            activeOpacity={0.7}
            onPress={() => setShowDetails(true)}
          >
            <View style={styles.glassBackground} />
            <View style={styles.glassContentRow}>
              {/* Rating */}
              <View style={styles.glassInfoItem}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.glassInfoText}>{post.rating || "N/A"}/10</Text>
              </View>
              
              {/* Location */}
              <View style={styles.glassInfoItem}>
                <Ionicons name="location" size={12} color="#FFD700" />
                <Text style={styles.glassInfoText} numberOfLines={1}>
                  {post.location_name || "N/A"}
                </Text>
              </View>
              
              {/* Username */}
              <View style={styles.glassInfoItem}>
                <Ionicons name="person" size={12} color="#FFD700" />
                <Text style={styles.glassInfoText} numberOfLines={1}>
                  {post.username || "N/A"}
                </Text>
              </View>
              
              {/* Chevron */}
              <View style={styles.glassChevronContainer}>
                <Ionicons name="chevron-up" size={18} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* GLASS OVERLAY DETAILS - Full screen with transparent bottom sheet */}
      {showDetails && (
        <View style={styles.detailsGlassOverlay}>
          {/* Semi-transparent backdrop - tap to close */}
          <TouchableOpacity 
            style={styles.overlayBackdrop}
            activeOpacity={1}
            onPress={() => setShowDetails(false)}
          />
          
          {/* Bottom sheet with glass effect */}
          <View style={styles.bottomSheetDetails}>
            <View style={styles.glassDetailsBackground} />
            
            {/* Drag Handle - swipeable */}
            <View 
              style={styles.dragHandleContainer}
              {...panResponder.panHandlers}
            >
              <View style={styles.dragHandle} />
            </View>
            
            {/* Scrollable Details Content */}
            <ScrollView 
              style={styles.detailsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* User Info Row without dropdown button */}
              <View style={styles.detailsUserRowContainer}>
                <TouchableOpacity
                  style={styles.detailsUserRow}
                  onPress={() => {
                    setShowDetails(false);
                    router.push(`/profile?userId=${post.user_id}`);
                  }}
                >
                  <UserAvatar
                    profilePicture={profilePic}
                    username={post.username}
                    level={post.user_level}
                    size={40}
                    showLevelBadge
                    style={{}}
                  />
                  <View style={styles.detailsUserInfo}>
                    <Text style={styles.detailsUsername}>{post.username}</Text>
                    <Text style={styles.detailsTimestamp}>{formatTime(post.created_at)}</Text>
                  </View>
                </TouchableOpacity>
                
                {/* Follow Button - Only show if not following and not own post */}
                {!isOwnPost && !isFollowing && (
                  <TouchableOpacity
                    style={styles.detailsFollowButton}
                    onPress={handleFollowToggle}
                    disabled={followLoading}
                  >
                    <Text style={styles.detailsFollowButtonText}>
                      {followLoading ? "..." : "Follow"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action Buttons with Cofau Theme */}
              <View style={styles.detailsActions}>
                <TouchableOpacity style={styles.detailsActionBtn} onPress={handleLikeToggle}>
                  {isLiked ? (
                    <GradientHeart size={18} />
                  ) : (
                    <Ionicons name="heart-outline" size={18} color="#000" />
                  )}
                  <Text style={styles.detailsActionText}>{likesCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.detailsActionBtn}
                  onPress={() => setShowComments(!showComments)}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="#000" />
                  <Text style={styles.detailsActionText}>{post.comments_count || comments.length}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.detailsActionBtn}
                  onPress={() => {
                    setShowDetails(false);
                    setShowShareModal(true);
                  }}
                >
                  <Ionicons name="share-outline" size={18} color="#000" />
                  <Text style={styles.detailsActionText}>{post.shares_count || 0}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.detailsActionBtn} onPress={handleSaveToggle}>
                  {isSaved ? (
                    <GradientBookmark size={18} />
                  ) : (
                    <Ionicons name="bookmark-outline" size={18} color="#000" />
                  )}
                  <Text style={styles.detailsActionText}>Save</Text>
                </TouchableOpacity>
              </View>

              {/* RATING Section */}
              {post.rating && (
                <View style={styles.detailsCard}>
                  <View style={styles.detailsCardHeader}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.detailsCardLabel}>RATING</Text>
                  </View>
                  <Text style={styles.detailsRatingValue}>{post.rating}/10</Text>
                </View>
              )}

              {/* REVIEW Section */}
              {post.review_text && (
                <View style={styles.detailsCard}>
                  <View style={styles.detailsCardHeader}>
                    <Ionicons name="create" size={16} color="#FFD700" />
                    <Text style={styles.detailsCardLabel}>REVIEW</Text>
                  </View>
                  <Text style={styles.detailsReviewText}>{post.review_text}</Text>
                </View>
              )}

              {/* LOCATION Section */}
              {post.location_name && (
                <TouchableOpacity 
                  style={styles.detailsCard}
                  onPress={() => {
                    if (post.map_link) {
                      Linking.openURL(post.map_link);
                    } else if (post.location_name) {
                      const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
                      Linking.openURL(searchUrl);
                    }
                  }}
                >
                  <View style={styles.detailsCardHeader}>
                    <Ionicons name="location" size={16} color="#FFD700" />
                    <Text style={styles.detailsCardLabel}>LOCATION</Text>
                  </View>
                  <View style={styles.locationRow}>
                    <Text style={styles.detailsLocationText}>{post.location_name}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </View>
                </TouchableOpacity>
              )}

              {/* Comments Section */}
              {showComments && (
                <View style={styles.detailsCommentsSection}>
                  <Text style={styles.detailsCommentsTitle}>
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
                          <Text style={styles.commentTime}>{formatTime(c.created_at)}</Text>
                        </View>
                      </View>
                    ))
                  )}

                  <View style={styles.commentInputContainer}>
                    <TextInput
                      value={commentText}
                      onChangeText={setCommentText}
                      placeholder="Add a comment…"
                      style={styles.commentInput}
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, !commentText.trim() && { backgroundColor: "#ccc" }]}
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

              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </View>
      )}

      {/* Share Modal */}
      <SharePreviewModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        post={post}
      />
    </View>
  );
}

export default function PostDetailsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { token, user } = useAuth() as any;
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [initialPostIndex, setInitialPostIndex] = useState(0);
  const [currentVisiblePost, setCurrentVisiblePost] = useState<any>(null);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(postId as string);
  const flatListRef = useRef<FlatList<any> | null>(null);

  const LIMIT = 10;

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0].item;
      setCurrentVisiblePost(visibleItem);
      // Update visible post ID to control video playback
      setVisiblePostId(visibleItem.id);
    } else {
      // If no items are visible, clear the visible post ID to pause all videos
      setVisiblePostId(null);
    }
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

  useEffect(() => {
    if (postId && token) loadInitialPost();
  }, [postId, token]);

  const loadInitialPost = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/feed?skip=0`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const currentIndex = res.data.findIndex((p: any) => p.id === postId);
      if (currentIndex === -1) {
        Alert.alert("Error", "Post not found");
        router.back();
        return;
      }

      const normalized = res.data.map((p: any) => ({
        ...p,
        media_url: normalizeUrl(p.media_url),
        image_url: normalizeUrl(p.image_url || p.media_url),
        thumbnail_url: normalizeUrl(p.thumbnail_url),
        user_profile_picture: normalizeUrl(p.user_profile_picture),
      }));

      const postsFromCurrent = normalized.slice(currentIndex);
      setPosts(postsFromCurrent);
      setInitialPostIndex(0);
      setCurrentVisiblePost(postsFromCurrent[0]);
      setVisiblePostId(postsFromCurrent[0]?.id || postId);
      setSkip(postsFromCurrent.length);

      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 100);
    } catch (e) {
      console.log("❌ Post fetch error", e);
      Alert.alert("Error", "Unable to load post");
    } finally {
      setLoading(false);
    }
  };

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

      const normalized = res.data.map((p: any) => ({
        ...p,
        media_url: normalizeUrl(p.media_url),
        image_url: normalizeUrl(p.image_url || p.media_url),
        thumbnail_url: normalizeUrl(p.thumbnail_url),
        user_profile_picture: normalizeUrl(p.user_profile_picture),
      }));

      const existingIds = new Set(posts.map((p: any) => p.id));
      const newPosts = normalized.filter((p: any) => !existingIds.has(p.id));

      setPosts((prev) => [...prev, ...newPosts]);
      setSkip((prev) => prev + newPosts.length);
      if (newPosts.length < LIMIT) setHasMore(false);
    } catch (e) {
      console.log("❌ Load more error", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderPostItem = useCallback(
    ({ item }: any) => (
      <PostItem
        post={item}
        currentPostId={visiblePostId}
        token={token}
        bottomInset={insets.bottom}
      />
    ),
    [visiblePostId, token, insets.bottom]
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    );
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text style={{ color: "#fff", marginTop: 10 }}>Loading post...</Text>
      </View>
    );

  if (posts.length === 0)
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: "#fff" }}>Post not found</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <FlatList
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
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data: any, index: number) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info: any) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          }, 500);
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------
   STYLES
----------------------------------------------------------*/
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#000" 
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },

  postItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },

  responsiveMediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },

  mediaWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  responsiveMedia: {
    width: "100%",
    height: "100%",
  },

  muteIndicatorReels: {
    position: "absolute",
    top: 100,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 20,
    padding: 8,
    zIndex: 50,
  },

  /* Top User Info Bar */
  topUserInfoBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
    marginRight: 12,
  },

  topUserRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  topUserDetails: {
    marginLeft: 12,
    flex: 1,
  },

  topHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  topFollowButton: {
    backgroundColor: "#4dd0e1",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },

  topFollowButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  topUsername: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },

  topTimestamp: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 2,
  },

  optionsButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
    marginLeft: 12,
  },

  optionsMenuBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },

  optionsMenuOverlay: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 90,
    right: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
    minWidth: 150,
  },

  optionsMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },

  optionsMenuText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },

  /* Glass Bottom Overlay - Evenly Distributed */
  glassBottomOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 10,
    borderRadius: 25,
    overflow: "hidden",
  },

  glassBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(120, 120, 120, 0.4)",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backdropFilter: "blur(20px)",
  },

  glassContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  glassInfoItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  glassInfoText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "660",
  },

  glassChevronContainer: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  /* NEW: Glass Overlay Details - Full screen with bottom sheet */
  detailsGlassOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 70,
  },

  overlayBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },

  bottomSheetDetails: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.6,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: "hidden",
  },

  glassDetailsBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(20px)",
  },

  dragHandleContainer: {
    paddingVertical: 16,
    paddingHorizontal: 50,
    alignItems: "center",
    backgroundColor: "rgba(200, 200, 200, 0)",
  },

  dragHandle: {
    width: 50,
    height: 6,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 3,
  },

  detailsScrollContent: {
    flex: 1,
  },

  /* User Row without dropdown button */
  detailsUserRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderBottomWidth: 0,
    borderBottomColor: "#F0F0F0",
    justifyContent: "space-between",
  },

  detailsUserRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  detailsUserInfo: {
    marginLeft: 12,
    flex: 1,
  },

  detailsFollowButton: {
    backgroundColor: "#1B7C82",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 3,
  },

  detailsFollowButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  detailsUsername: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  detailsTimestamp: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },

  detailsActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    borderBottomWidth: 0,
    borderBottomColor: "#F0F0F0",
  },

  detailsActionBtn: {
    alignItems: "center",
    gap: 4,
  },

  detailsActionText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },

  /* Details Cards */
  detailsCard: {
    backgroundColor: "rgba(255, 255, 255, 0.3)", 
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    backdropFilter: "blur(10px)",  
  },

  detailsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },

  detailsCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.5,
  },

  detailsRatingValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },

  detailsReviewText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "700",
    lineHeight: 19,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailsLocationText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "700",
    flex: 1,
  },

  detailsCommentsSection: {
    padding: 16,
  },

  detailsCommentsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
  },

  noComments: {
    textAlign: "center",
    color: "#8E8E8E",
    marginTop: 20,
    marginBottom: 20,
    fontSize: 14,
  },

  commentItem: {
    flexDirection: "row",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#EFEFEF",
  },

  commentContent: {
    marginLeft: 12,
    flex: 1,
  },

  commentUsername: {
    fontSize: 14,
    fontWeight: "700",
    color: "#262626",
  },

  commentText: {
    marginTop: 4,
    fontSize: 14,
    color: "#262626",
    lineHeight: 20,
  },

  commentTime: {
    marginTop: 6,
    fontSize: 12,
    color: "#8E8E8E",
  },

  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderColor: "#DBDBDB",
  },

  commentInput: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#DBDBDB",
  },

  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: "#4dd0e1",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaContainerShrunk: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.6,  // Adjust this value (0.35 to 0.45) to fit perfectly above banner
    zIndex: 5,
  },

  footerLoader: {
    padding: 20,
    alignItems: "center",
  },
  videoErrorContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  videoErrorText: {
    color: "#999",
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#4dd0e1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});