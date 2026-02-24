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
  Pressable,
  Animated,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import SharePreviewModal from "../../components/SharePreviewModal";
import ReportModal from "../../components/ReportModal";
import { followUser, unfollowUser, getComments, addComment } from "../../utils/api";
import axios from "axios";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalizeMediaUrl, normalizeProfilePicture } from "../../utils/imageUrlFix";
import { BlurView } from 'expo-blur';
import CofauVerifiedBadge from "../../components/CofauVerifiedBadge";

const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${BACKEND}/api`;
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const SHEET_HEIGHT_RATIO = 0.5;
const SHEET_OPEN_TOP = SCREEN_HEIGHT * (1 - SHEET_HEIGHT_RATIO);

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
      colors={["#FF2E2E", "#FF7A18"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

const GradientLocation = ({ size = 18 }) => (
  <MaskedView
    maskElement={
      <View style={{ backgroundColor: 'transparent' }}>
        <Ionicons name="location" size={size} color="#000" />
      </View>
    }
  >
    <LinearGradient
      colors={["#FF2E2E", "#FF5722", "#FF7A18"]}
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
      colors={["#FF2E2E", "#FF7A18"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

/* ---------------------------------------------------------
   POST ITEM COMPONENT
----------------------------------------------------------*/
function PostItem({ post, currentPostId, token, bottomInset, accountType }: any) {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [isLiked, setIsLiked] = useState(post.is_liked_by_user || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isSaved, setIsSaved] = useState(post.is_saved_by_user || false);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(post.comments_count || 0);
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
  const [thumbnailError, setThumbnailError] = useState(false);
  const videoRef = useRef(null);
  const [lastTap, setLastTap] = useState(0);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const muteIconOpacity = useRef(new Animated.Value(0)).current;
  const leftHalfX = useRef(new Animated.Value(-200)).current;
  const rightHalfX = useRef(new Animated.Value(200)).current;
  const mergedScale = useRef(new Animated.Value(1)).current;
  const heartOpacity = useRef(new Animated.Value(1)).current;
  const confettiAnims = useRef(
    Array.from({ length: 10 }, () => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
    }))
  ).current;

  // Animation values for expand-from-card bottom sheet
  const BOTTOM_NAV_HEIGHT_CONST = 130;
  const CARD_ORIGIN_Y = SCREEN_HEIGHT - BOTTOM_NAV_HEIGHT_CONST - 25; // center of white card
  const SHEET_CENTER_OFFSET = (SCREEN_HEIGHT * SHEET_HEIGHT_RATIO) / 2;
  const ORIGIN_TRANSLATE_Y = CARD_ORIGIN_Y - SHEET_CENTER_OFFSET; // translateY so sheet center = card center

  const bottomSheetAnim = useRef(new Animated.Value(ORIGIN_TRANSLATE_Y)).current;
  const sheetScaleAnim = useRef(new Animated.Value(0.02)).current;
  const sheetOpacityAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Update isFollowing state when post data changes
  useEffect(() => {
    setIsFollowing(post.is_following || false);
  }, [post.is_following]);

  // Check if this is the current user's own post
  const isOwnPost = user?.id === post.user_id;

  // Animate bottom sheet — expand from card / shrink back to card
  useEffect(() => {
    if (showDetails) {
      // Start tiny at the card's position
      bottomSheetAnim.setValue(ORIGIN_TRANSLATE_Y);
      sheetScaleAnim.setValue(0.02);
      sheetOpacityAnim.setValue(0);

      Animated.parallel([
        // Move from card center to open position
        Animated.spring(bottomSheetAnim, {
          toValue: SHEET_OPEN_TOP,
          useNativeDriver: true,
          tension: 55,
          friction: 11,
        }),
        // Scale from dot to full size
        Animated.spring(sheetScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 55,
          friction: 11,
        }),
        // Quick fade in
        Animated.timing(sheetOpacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Shrink back to the card's position
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: ORIGIN_TRANSLATE_Y,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(sheetScaleAnim, {
          toValue: 0.02,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacityAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showDetails]);

  // Pan responder for swipe down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow dragging down
        if (gestureState.dy > 0) {
          const newValue = SHEET_OPEN_TOP + gestureState.dy;
          bottomSheetAnim.setValue(newValue);

          // Shrink slightly as dragged down
          const dragProgress = Math.min(gestureState.dy / 300, 1);
          sheetScaleAnim.setValue(1 - dragProgress * 0.3);

          const opacity = 0.3 * (1 - dragProgress);
          backdropOpacity.setValue(Math.max(0, opacity));
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If dragged down more than 100px, close (shrink to card)
        if (gestureState.dy > 100) {
          setShowDetails(false);
        } else {
          // Snap back to open position
          Animated.parallel([
            Animated.spring(bottomSheetAnim, {
              toValue: SHEET_OPEN_TOP,
              useNativeDriver: true,
              tension: 55,
              friction: 11,
            }),
            Animated.spring(sheetScaleAnim, {
              toValue: 1,
              useNativeDriver: true,
              tension: 55,
              friction: 11,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0.3,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const isVideo = (post.media_type || "").toLowerCase() === "video";
  const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
  const imageUrl = normalizeMediaUrl(post.image_url || post.media_url);
  const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
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
      const data = await getComments(post.id, post.account_type || accountType);
      const normalized = data.map((c: any) => ({
        ...c,
        profile_pic: normalizeProfilePicture(c.profile_pic),
      }));
      setComments(normalized);
      setCommentCount(normalized.length);
    } catch (e) {
      console.error("Error fetching comments:", e);
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
      await addComment(post.id, commentText.trim(), token, post.account_type || accountType);
      setCommentText("");
      await fetchComments();
    } catch (e) {
      Alert.alert("Error", "Unable to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTime = (timestamp: string | null | undefined): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
 const handleDoubleTap = () => {
  const now = Date.now();
  const DOUBLE_TAP_DELAY = 300; // milliseconds

  if (now - lastTap < DOUBLE_TAP_DELAY) {
    // Double tap detected - like the post
    if (!isLiked) {
      handleLikeToggle();
    }
    // Reset all animation values
    leftHalfX.setValue(-200);
    rightHalfX.setValue(200);
    mergedScale.setValue(1);
    heartOpacity.setValue(1);
    confettiAnims.forEach((c) => {
      c.opacity.setValue(0);
      c.scale.setValue(0);
      c.translateX.setValue(0);
      c.translateY.setValue(0);
    });
    setShowHeartAnimation(true);

    // Phase 1: Two halves slide in from left and right
    Animated.parallel([
      Animated.timing(leftHalfX, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(rightHalfX, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Bounce on merge + confetti burst
      Animated.sequence([
        Animated.spring(mergedScale, {
          toValue: 1.3,
          friction: 3,
          tension: 180,
          useNativeDriver: true,
        }),
        Animated.spring(mergedScale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();

      // Confetti burst when halves meet
      const confettiAnimations = confettiAnims.map((c, i) => {
        const angle = (i / confettiAnims.length) * Math.PI * 2;
        const distance = 80 + Math.random() * 60;
        return Animated.parallel([
          Animated.sequence([
            Animated.timing(c.opacity, { toValue: 1, duration: 50, useNativeDriver: true }),
            Animated.timing(c.opacity, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
          ]),
          Animated.timing(c.scale, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(c.translateX, { toValue: Math.cos(angle) * distance, duration: 600, useNativeDriver: true }),
          Animated.timing(c.translateY, { toValue: Math.sin(angle) * distance, duration: 600, useNativeDriver: true }),
        ]);
      });
      Animated.parallel(confettiAnimations).start();

      // Phase 3: Fade out after a pause
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowHeartAnimation(false);
      });
    });
  } else {
    // Single tap - mute/unmute video (only for videos)
    if (isVideo && shouldPlay) {
      setIsMuted(!isMuted);
      // Show mute icon briefly (Instagram-style)
      setShowMuteIcon(true);
      muteIconOpacity.setValue(1);

      // Fade out after 1.5 seconds
      setTimeout(() => {
        Animated.timing(muteIconOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowMuteIcon(false);
        });
      }, 1200);
    }
  }
  setLastTap(now);
};
  return (
    <View style={styles.postItem}>
      {/* MEDIA CONTAINER - Animated for Instagram-style scaling */}
      <View
        style={styles.responsiveMediaContainer}
      >
        {/* BLURRED BACKGROUND LAYER */}
        {!isVideo ? (
          // For images - blurred background
          Platform.OS === 'ios' ? (
            <View style={styles.blurredBackground}>
              <Image
                source={{ uri: imageUrl || displayUrl || '' }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={50}
              />
              <BlurView 
                intensity={100}
                style={StyleSheet.absoluteFill}
                tint="dark"
              />
            </View>
          ) : (
            <Image
              source={{ uri: imageUrl || displayUrl || '' }}
              style={styles.blurredBackground}
              contentFit="cover"
              blurRadius={25}
            />
          )
        ) : (
          // For videos - use thumbnail or first frame as blurred background
          Platform.OS === 'ios' ? (
            <View style={styles.blurredBackground}>
              <Image
                source={{ uri: thumbnailUrl || mediaUrl || displayUrl || '' }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={50}
              />
              <BlurView 
                intensity={100}
                style={StyleSheet.absoluteFill}
                tint="dark"
              />
            </View>
          ) : (
            <Image
              source={{ uri: thumbnailUrl || mediaUrl || displayUrl || '' }}
              style={styles.blurredBackground}
              contentFit="cover"
              blurRadius={25}
            />
          )
        )}

       {/* MAIN MEDIA - on top */}
        <Pressable 
          style={styles.mediaWrapper}
          onPress={handleDoubleTap}
        >
          {isVideo ? (
            <>
              {/* Thumbnail - Always rendered, hidden when video is playing (Critical for iOS) */}
              {(!videoLoaded || videoError || !shouldPlay) && !thumbnailError && (thumbnailUrl || mediaUrl || displayUrl) && (
                <Image
                  source={{ uri: (thumbnailUrl || mediaUrl || displayUrl) as string }}
                  style={[
                    styles.responsiveMedia,
                    videoLoaded && shouldPlay && styles.hiddenImage
                  ] as any}
                  contentFit="contain"
                  onError={() => {
                    console.error("❌ Thumbnail error in post details");
                    setThumbnailError(true);
                  }}
                />
              )}

              {/* Video - Only render when shouldPlay is true and no error (Critical for iOS performance) */}
              {shouldPlay && !videoError && (
                <Video
                  ref={videoRef}
                  source={{
                    uri: mediaUrl || displayUrl || '',
                    headers: {
                      'Accept': 'video/mp4, video/quicktime, video/*',
                      'User-Agent': 'Cofau/1.0',
                    }
                  }}
                  style={[
                    styles.responsiveMedia,
                    !videoLoaded && styles.hiddenVideo
                  ]}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={shouldPlay}
                  isLooping
                  isMuted={isMuted}
                  useNativeControls={false}
                  allowsExternalPlayback={false}
                  playInSilentModeIOS={true}
                  usePoster={false}
                  posterSource={null}
                  onLoad={(status: any) => {
                    if (!videoLoaded) {
                      setVideoLoaded(true);
                    }
                    if (videoError) {
                      setVideoError(false);
                    }
                    if (videoRef.current && shouldPlay) {
                      setTimeout(async () => {
                        try {
                          const currentStatus = await (videoRef.current as any).getStatusAsync();
                          if (currentStatus.isLoaded && !currentStatus.isPlaying && shouldPlay) {
                            await (videoRef.current as any).playAsync();
                            const afterPlayStatus = await (videoRef.current as any).getStatusAsync();
                            if (!afterPlayStatus.isPlaying && shouldPlay) {
                              setTimeout(async () => {
                                try {
                                  await (videoRef.current as any).playAsync();
                                } catch (retryErr) {
                                }
                              }, 300);
                            }
                          }
                        } catch (err) {
                        }
                      }, 200);
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
                    if (videoError) {
                      setVideoError(false);
                    }
                  }}
                  onPlaybackStatusUpdate={(status: any) => {
                    if (!shouldPlay && status.isLoaded && status.isPlaying && videoRef.current) {
                      (videoRef.current as any).pauseAsync().catch(() => {});
                      (videoRef.current as any).setPositionAsync(0).catch(() => {});
                    }
                    if (status.isLoaded && !status.isPlaying && shouldPlay && videoLoaded) {
                      (videoRef.current as any)?.playAsync().catch((err: any) => {});
                    }
                  }}
                  progressUpdateIntervalMillis={1000}
                />
              )}

              {/* Play icon overlay - Only show when video is not playing */}
              {(!shouldPlay || videoError || !videoLoaded) && (
                <View style={styles.playIconOverlay}>
                  <Ionicons name="play-circle-outline" size={60} color="rgba(255,255,255,0.9)" />
                </View>
              )}

              {/* Fallback placeholder if thumbnail fails */}
              {thumbnailError && !videoLoaded && (
                <View style={styles.videoPlaceholder}>
                  <Ionicons name="videocam-outline" size={40} color="#999" />
                  <Text style={styles.videoPlaceholderText}>Video</Text>
                </View>
              )}

              {/* Error container - Show when video fails to load */}
              {videoError && (
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

              {/* Mute indicator - Instagram style: centered, appears briefly on tap */}
              {showMuteIcon && (
                <Animated.View
                  style={[
                    styles.muteIconOverlay,
                    { opacity: muteIconOpacity }
                  ]}
                  pointerEvents="none"
                >
                  <View style={styles.muteIconContainer}>
                    <Ionicons
                      name={isMuted ? "volume-mute" : "volume-high"}
                      size={40}
                      color="#fff"
                    />
                  </View>
                </Animated.View>
              )}
            </>
          ) : (
            <Image
              source={{ uri: imageUrl || displayUrl || '' }}
              style={styles.responsiveMedia}
              contentFit="contain"
            />
          )}
          
          {/* Double Tap Heart Animation */}
          {showHeartAnimation && (
            <View style={styles.heartAnimationContainer}>
              <Animated.View style={{ opacity: heartOpacity }}>
                {/* Two halves + merged heart */}
                <Animated.View style={{ transform: [{ scale: mergedScale }], flexDirection: 'row' }}>
                  {/* Left half */}
                  <Animated.View style={{ width: 60, height: 120, overflow: 'hidden', transform: [{ translateX: leftHalfX }] }}>
                    <GradientHeart size={120} />
                  </Animated.View>
                  {/* Right half */}
                  <Animated.View style={{ width: 60, height: 120, overflow: 'hidden', transform: [{ translateX: rightHalfX }] }}>
                    <View style={{ marginLeft: -60 }}>
                      <GradientHeart size={120} />
                    </View>
                  </Animated.View>
                </Animated.View>
                {/* Confetti particles */}
                {confettiAnims.map((c: any, i: number) => (
                  <Animated.View
                    key={i}
                    style={{
                      position: 'absolute',
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: ['#FF2E2E', '#FF7A18', '#FFD700', '#FF6B35', '#FF4757', '#FFA502', '#FF6348', '#FF3838', '#FFAA33', '#FF5252'][i],
                      alignSelf: 'center',
                      top: '50%',
                      marginTop: -4,
                      opacity: c.opacity,
                      transform: [{ translateX: c.translateX }, { translateY: c.translateY }, { scale: c.scale }],
                    }}
                  />
                ))}
              </Animated.View>
            </View>
          )}
        </Pressable>

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.topUsername}>{post.username}</Text>
                  {post.user_badge === 'verified' && <CofauVerifiedBadge size={14} />}
                </View>
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
      {/* Delete Post - Only show for own posts */}
      {isOwnPost && (
        <TouchableOpacity
          style={styles.optionsMenuItem}
          onPress={() => {
            setShowOptionsMenu(false);
            Alert.alert(
              "Delete Post",
              "Are you sure you want to delete this post?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const deleteEndpoint =
                        accountType === 'restaurant' ||
                        post.account_type === 'restaurant' ||
                        post.is_restaurant_post
                          ? `${API_URL}/restaurant/posts/${post.id}`
                          : `${API_URL}/posts/${post.id}`;
                      await axios.delete(deleteEndpoint, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      Alert.alert("Success", "Post deleted successfully");
                      router.back();
                    } catch (error) {
                      console.error("Delete error:", error);
                      Alert.alert("Error", "Failed to delete post");
                    }
                  },
                },
              ]
            );
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#E94A37" />
          <Text style={styles.optionsMenuText}>Delete Post</Text>
        </TouchableOpacity>
      )}
      
      {/* Report Post - Show for all users */}
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

        {/* Right Side Action Bar */}
{!showDetails && (
  <View style={[styles.rightActionBar, { bottom: BOTTOM_NAV_HEIGHT + 70 }]}>
    {/* Heart / Like */}
    <TouchableOpacity style={styles.rightActionBtn} onPress={handleLikeToggle}>
      {isLiked ? (
        <GradientHeart size={28} />
      ) : (
        <Ionicons name="heart-outline" size={28} color="#FFF" />
      )}
      <Text style={styles.rightActionCount}>{likesCount}</Text>
    </TouchableOpacity>

    {/* Comment */}
    <TouchableOpacity style={styles.rightActionBtn} onPress={() => setShowComments(true)}>
      <Ionicons name="chatbubble-outline" size={26} color="#FFF" />
      <Text style={styles.rightActionCount}>{commentCount}</Text>
    </TouchableOpacity>

    {/* Share */}
    <TouchableOpacity style={styles.rightActionBtn} onPress={() => setShowShareModal(true)}>
      <Ionicons name="paper-plane-outline" size={26} color="#FFF" />
      <Text style={styles.rightActionCount}>{post.shares_count || 0}</Text>
    </TouchableOpacity>

    {/* Location - opens Google Maps */}
    <TouchableOpacity
      style={styles.rightActionBtn}
      onPress={() => {
        if (post.map_link) {
          Linking.openURL(post.map_link);
        } else if (post.location_name) {
          const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
          Linking.openURL(searchUrl);
        } else {
          Alert.alert("Location", "No location available for this post");
        }
      }}
    >
      <GradientLocation size={30} />
    </TouchableOpacity>
  </View>
)}

        {/* Bottom Overlay - Review + Tap to expand */}
{!showDetails && (
  <TouchableOpacity
    style={[styles.bottomOverlay, { bottom: BOTTOM_NAV_HEIGHT }]}
    activeOpacity={0.9}
    onPress={() => setShowDetails(true)}
  >
    <View style={styles.bottomOverlayIconWrap}>
      <Ionicons name="create-outline" size={16} color="#FF5722" />
    </View>
    <View style={{ flex: 1, marginRight: 10 }}>
      <Text style={styles.bottomOverlayText} numberOfLines={2} ellipsizeMode="tail">
        {(post.account_type === 'restaurant' || post.is_restaurant_post)
          ? (post.dish_details || post.description || post.review_text || post.dish_name || "Tap for details")
          : (post.review_text || post.dish_name || "Tap for details")}
      </Text>
    </View>
    <View style={styles.bottomOverlayArrow}>
      <Ionicons name="chevron-up" size={16} color="#333" />
    </View>
  </TouchableOpacity>
)}

      {/* GLASS OVERLAY DETAILS - Instagram-style bottom sheet */}
      <>
        {/* Semi-transparent backdrop - tap to close */}
        <Animated.View
          style={[
            styles.overlayBackdrop,
            {
              opacity: backdropOpacity,
              pointerEvents: showDetails ? 'auto' : 'none',
            }
          ]}
          pointerEvents={showDetails ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowDetails(false)}
          />
        </Animated.View>

        {/* Bottom sheet with glass effect */}
        <Animated.View
          style={[
            styles.bottomSheetDetails,
            {
              opacity: sheetOpacityAnim,
              transform: [
                { translateY: bottomSheetAnim },
                { scale: sheetScaleAnim },
              ],
            },
          ]}
        >
          <View style={styles.glassDetailsBackground} />

          {/* Drag Handle - tap to close or swipe down */}
          <TouchableOpacity
            style={styles.dragHandleContainer}
            activeOpacity={0.7}
            onPress={() => setShowDetails(false)}
            {...panResponder.panHandlers}
          >
            <View style={styles.dragHandle} />
          </TouchableOpacity>
            
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.detailsUsername}>{post.username}</Text>
                      {post.user_badge === 'verified' && <CofauVerifiedBadge size={14} />}
                    </View>
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

              {/* ALL-IN-ONE DETAILS CARD */}
              <View style={styles.detailsSingleCard}>
                {/* RATING or PRICE */}
{post.account_type === 'restaurant' || post.is_restaurant_post ? (
  post.price ? (
    <View style={styles.detailsSection}>
      <Text style={styles.detailsSectionLabel}>PRICE</Text>
      <View style={styles.detailsSectionRow}>
        <Ionicons name="pricetag" size={19} color="#FFD700" />
        <Text style={styles.detailsSectionValue}>₹{post.price}</Text>
      </View>
    </View>
  ) : null
) : (
  post.rating ? (
    <View style={styles.detailsSection}>
      <Text style={styles.detailsSectionLabel}>RATING</Text>
      <View style={styles.detailsSectionRow}>
        <Ionicons name="star" size={19} color="#FFD700" />
        <Text style={styles.detailsSectionValue}>{post.rating}/10</Text>
      </View>
    </View>
  ) : null
)}

                {/* DISH NAME */}
                {post.dish_name && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionLabel}>DISH NAME</Text>
                    <View style={styles.detailsSectionRow}>
                      <Ionicons name="fast-food" size={19} color="#FFD700" />
                      <Text style={styles.detailsSectionValue}>{post.dish_name}</Text>
                    </View>
                  </View>
                )}

                {/* REVIEW / ABOUT */}
{post.account_type === 'restaurant' || post.is_restaurant_post ? (
  (post.dish_details || post.description || post.review_text) ? (
    <View style={styles.detailsSection}>
      <Text style={styles.detailsSectionLabel}>ABOUT</Text>
      <View style={styles.detailsSectionRow}>
        <Ionicons name="information-circle" size={19} color="#FFD700" />
        <Text style={styles.detailsSectionText}>
          {post.dish_details || post.description || post.review_text}
        </Text>
      </View>
    </View>
  ) : null
) : (
  post.review_text ? (
    <View style={styles.detailsSection}>
      <Text style={styles.detailsSectionLabel}>REVIEW</Text>
      <View style={styles.detailsSectionRow}>
        <Ionicons name="create" size={19} color="#FFD700" />
        <Text style={styles.detailsSectionText}>{post.review_text}</Text>
      </View>
    </View>
  ) : null
)}

                {/* LOCATION */}
                {post.location_name && (
                  <View style={[styles.detailsSection, { borderBottomWidth: 0 }]}>
                    <Text style={styles.detailsSectionLabel}>LOCATION</Text>
                    <Pressable
                      onPress={() => {
                        if (post.map_link) {
                          Linking.openURL(post.map_link);
                        } else if (post.location_name) {
                          const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
                          Linking.openURL(searchUrl);
                        }
                      }}
                      style={({ pressed }: any) => [{ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                    >
                      <LinearGradient
                        colors={['rgba(255,46,46,0.10)', 'rgba(255,122,24,0.08)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.detailsLocationGradient}
                      >
                        <Ionicons name="location" size={18} color="#FF2E2E" />
                        <Text style={styles.detailsLocationText} numberOfLines={1}>{post.location_name}</Text>
                        <View style={{ flex: 1 }} />
                        <View style={styles.detailsLocationArrow}>
                          <Ionicons name="chevron-forward" size={14} color="#fff" />
                        </View>
                      </LinearGradient>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* SAVE BUTTON - FeedCard style */}
              <TouchableOpacity style={styles.detailsSaveBtn} onPress={handleSaveToggle} activeOpacity={0.8}>
                <View style={styles.detailsSaveIconWrap}>
                  {isSaved ? (
                    <GradientBookmark size={18} />
                  ) : (
                    <Ionicons name="bookmark-outline" size={18} color="#888" />
                  )}
                </View>
                <Text style={[styles.detailsSaveText, isSaved && { color: '#FF5722' }]}>
                  {isSaved ? "Saved" : "Save"}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 100 }} />
            </ScrollView>

          </Animated.View>
        </>
       </View>

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <TouchableOpacity
            style={styles.commentsModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowComments(false)}
          />
          <View style={styles.commentsModalSheet}>
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <View style={styles.commentsHandleBar} />
            </View>

            <View style={styles.commentsHeader}>
              <Text style={styles.commentsHeaderTitle}>
                Comments ({commentCount})
              </Text>
              <TouchableOpacity
                style={styles.commentsCloseButton}
                onPress={() => setShowComments(false)}
              >
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.commentsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
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
            </ScrollView>

            <View style={styles.commentInputContainer}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor="#999"
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={post.id}
      />

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
  const { postId, profileUserId, profilePicture, profileUsername, profileLevel } = useLocalSearchParams();
  const { token, user, accountType } = useAuth() as any;
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

  const normalizePostData = (data: any) => ({
    ...data,
    media_url: normalizeUrl(data.media_url),
    image_url: normalizeUrl(data.image_url || data.media_url),
    thumbnail_url: normalizeUrl(data.thumbnail_url),
    user_profile_picture: normalizeUrl(
      data.user_profile_picture || data.restaurant_profile_picture
    ),
    username: data.username || data.restaurant_name,
    user_id: data.user_id || data.restaurant_id,
  });

  const fetchSinglePost = async (endpoint: string) => {
    const res = await axios.get(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return normalizePostData(res.data);
  };

  const loadInitialPost = async () => {
    try {
      setLoading(true);
      
      // ✅ SOLUTION: Fetch ONLY the single post first
      const primaryEndpoint =
        accountType === 'restaurant'
          ? `${API_URL}/restaurant/posts/${postId}`
          : `${API_URL}/posts/${postId}`;
      let singlePost;
      try {
        singlePost = await fetchSinglePost(primaryEndpoint);
      } catch (primaryError) {
        // Try the other endpoint as fallback
        const fallbackEndpoint =
          accountType === 'restaurant'
            ? `${API_URL}/posts/${postId}`
            : `${API_URL}/restaurant/posts/${postId}`;
        singlePost = await fetchSinglePost(fallbackEndpoint);
      }
      
      // Set the single post immediately - FAST LOAD!
      setPosts([singlePost]);
      setInitialPostIndex(0);
      setCurrentVisiblePost(singlePost);
      setVisiblePostId(singlePost.id);
      setLoading(false);  // Stop loading immediately

      // ✅ Load more posts in the BACKGROUND for scrolling (delayed to not interfere with rendering)
      setTimeout(() => {
        loadMorePostsInBackground();
      }, 800);
      
    } catch (e) {
      
      // Fallback: If single post endpoint doesn't exist, use old method
      loadInitialPostFallback();
    }
  };

  // Background loading for smooth scrolling experience
  const loadMorePostsInBackground = async () => {
    try {
      // Fetch only 5 posts initially for faster background load
      const backgroundLimit = 5;
      const endpoint = profileUserId
  ? accountType === 'restaurant'
    ? `${API_URL}/restaurant/posts/public/restaurant/${profileUserId}?limit=${backgroundLimit}&skip=0`
    : `${API_URL}/users/${profileUserId}/posts?limit=${backgroundLimit}&skip=0`
  : `${API_URL}/feed?limit=${backgroundLimit}&skip=0`;
const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const normalized = res.data.map((p: any) => ({
  ...p,
  media_url: normalizeUrl(p.media_url),
  image_url: normalizeUrl(p.image_url || p.media_url),
  thumbnail_url: normalizeUrl(p.thumbnail_url),
  // If coming from profile, use first post's user info for all posts
 user_profile_picture: normalizeUrl(p.user_profile_picture || p.restaurant_profile_picture) || (profileUserId ? decodeURIComponent(profilePicture as string || '') : null),
username: p.username || p.restaurant_name || (profileUserId ? decodeURIComponent(profileUsername as string || '') : null),
user_level: p.user_level || (profileUserId ? Number(profileLevel) || 1 : null),
  user_id: p.user_id || p.restaurant_id || profileUserId,
}));

      // Add posts that aren't the current one
      const otherPosts = normalized.filter((p: any) => p.id !== postId);

      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = otherPosts.filter((p: any) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });

      // Update skip to match the number of posts actually loaded
      setSkip(5);
    } catch (e) {
    }
  };

  // Fallback if single post endpoint doesn't exist
  const loadInitialPostFallback = async () => {
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
    } catch (e) {
      Alert.alert("Error", "Unable to load post");
    } finally {
      setLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const endpoint = profileUserId 
  ? accountType === 'restaurant'
    ? `${API_URL}/restaurant/posts/public/restaurant/${profileUserId}?limit=${LIMIT}&skip=${skip}`
    : `${API_URL}/users/${profileUserId}/posts?limit=${LIMIT}&skip=${skip}`
  : `${API_URL}/feed?limit=${LIMIT}&skip=${skip}`;
const res = await axios.get(endpoint, {
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
  // If coming from profile, use first post's user info for all posts
user_profile_picture: normalizeUrl(p.user_profile_picture || p.restaurant_profile_picture) || (profileUserId ? decodeURIComponent(profilePicture as string || '') : null),
username: p.username || p.restaurant_name || (profileUserId ? decodeURIComponent(profileUsername as string || '') : null),
user_level: p.user_level || (profileUserId ? Number(profileLevel) || 1 : null),
  user_id: p.user_id || p.restaurant_id || profileUserId,
}));

      if (res.data.length < LIMIT) setHasMore(false);
      setSkip((s) => s + res.data.length);

      setPosts((prev) => {
        const existingIds = new Set(prev.map((p: any) => p.id));
        const newPosts = normalized.filter((p: any) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
    } catch (e) {
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
        accountType={accountType}
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
    position: "relative",
  },

  responsiveMediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  mediaWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  responsiveMedia: {
    width: "100%",
    height: "100%",
  },

  blurredBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },

  muteIconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 60,
  },

  muteIconContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 50,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Top User Info Bar */
  topUserInfoBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 46,
    zIndex: 10,
    backgroundColor: "transparent",
  },

  backButton: {
    padding: 8,
    marginRight: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fff',
  },
heartAnimationContainer: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.1)',
  zIndex: 100,
  pointerEvents: 'none',
},
  topFollowButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },

  topUsername: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  topTimestamp: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  optionsButton: {
    padding: 8,
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

  /* Right Side Action Bar */
  rightActionBar: {
    position: "absolute",
    right: 12,
    zIndex: 15,
    alignItems: "center",
    gap: 20,
  },

  rightActionBtn: {
    alignItems: "center",
    justifyContent: "center",
  },

  rightActionCount: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  /* Bottom Overlay - 3D White card */
  bottomOverlay: {
    position: "absolute",
    left: 24,
    right: 24,
    zIndex: 10,
    backgroundColor: "#FFF",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    borderBottomWidth: 4,
    borderBottomColor: "rgba(0, 0, 0, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },

  bottomOverlayIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 87, 34, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  bottomOverlayText: {
    color: "#222",
    fontSize: 12.5,
    fontWeight: "500",
    lineHeight: 17,
  },

  bottomOverlayArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    borderBottomWidth: 2.5,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Glass Overlay Details - Instagram-style bottom sheet */
  overlayBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 1)",
    zIndex: 50,
  },

  bottomSheetDetails: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    height: SCREEN_HEIGHT * SHEET_HEIGHT_RATIO,
    borderRadius: 24,
    overflow: "hidden",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },

  glassDetailsBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
  },

  dragHandleContainer: {
    paddingVertical: 12,
    paddingHorizontal: 50,
    alignItems: "center",
  },

  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#DDD",
    borderRadius: 3,
  },

  detailsScrollContent: {
    flex: 1,
  },

  /* User Row without dropdown button */
  detailsUserRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
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
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
  },

  detailsTimestamp: {
    fontSize: 11,
    color: "#999",
    marginTop: 3,
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

  /* Single Details Card (FeedCard style) */
  detailsSingleCard: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },

  detailsSection: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },

  detailsSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  detailsSectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  detailsSectionValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
  },

  detailsSectionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    flex: 1,
  },

  detailsLocationGradient: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },

  detailsLocationText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
  },

  detailsLocationArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF2E2E",
    justifyContent: "center",
    alignItems: "center",
  },

  detailsSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    gap: 8,
  },

  detailsSaveIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F3F3",
    justifyContent: "center",
    alignItems: "center",
  },

  detailsSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
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

  commentsModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },

  commentsModalSheet: {
    height: SCREEN_HEIGHT * 0.55,
    marginHorizontal: 12,
    marginBottom: Platform.OS === "ios" ? 30 : 16,
    backgroundColor: "#FFF",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },

  commentsHandleBar: {
    width: 40,
    height: 5,
    backgroundColor: "#DDD",
    borderRadius: 3,
  },

  commentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  commentsHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },

  commentsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },

  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  commentItem: {
    flexDirection: "row",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
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
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#FFF",
  },

  commentInput: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    maxHeight: 100,
    color: "#222",
  },

  sendButton: {
    width: 40,
    height: 40,
    backgroundColor: "#FF4500",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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

  hiddenImage: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
  },

  hiddenVideo: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: "100%",
    zIndex: 1,
  },

  playIconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },

  videoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  videoPlaceholderText: {
    color: "#999",
    fontSize: 14,
    marginTop: 8,
  },
});
