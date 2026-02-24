import React, { useState, useEffect, useRef } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
Image,
Linking,
Alert,
Modal,
TextInput,
ActivityIndicator,
Platform,
Pressable,
Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaskedView from "@react-native-masked-view/masked-view";
import CommentsModal from './CommentsModal';

import UserAvatar from "./UserAvatar";
import * as VideoThumbnails from 'expo-video-thumbnails';
import SharePreviewModal from "./SharePreviewModal";
import ShareToUsersModal from "./ShareToUsersModal";
import SimpleShareModal from "./SimpleShareModal";
import ReportModal from "./ReportModal";
import CofauVerifiedBadge from "./CofauVerifiedBadge";
import { useAuth } from "../context/AuthContext";
import {
likePost,
unlikePost,
savePost,
unsavePost,
reportPost,
sharePostToUsers,
addPostToStory,
incrementShareCount,
followUser,
unfollowUser,
blockUser,
} from "../utils/api";
import {
normalizeMediaUrl,
normalizeProfilePicture,
} from "../utils/imageUrlFix";

/* ----------------------------------------------------------
GRADIENT HEART ICON (COFAU)
-----------------------------------------------------------*/
const GradientHeart = ({ size = 24 }) => (
  <MaskedView maskElement={<Ionicons name="heart" size={size} color="#000" />}>
    <LinearGradient
      colors={["#FF2E2E", "#FF7A18"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

const GradientBookmark = ({ size = 24 }) => (
  <MaskedView maskElement={<Ionicons name="bookmark" size={size} color="#000" />}>
    <LinearGradient
      colors={["#FF2E2E", "#FF7A18"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);
function FeedCard({
  post,
  onLikeUpdate,
  onStoryCreated,
  showOptionsMenuProp = true,
  shouldPlay = false,
  shouldPreload = false,
  isMuted = true,
  onMuteToggle,
}) {
  // Add debug log HERE - inside the function

  // Debug: Check if tagged_restaurant and dish_name data is coming through

  if (post.tagged_restaurant) {
  } else {
  }

  if (post.dish_name) {
  } else {
  }

  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef(null);

const [isLiked, setIsLiked] = useState(post.is_liked || false);
const [likesCount, setLikes] = useState(post.likes || 0);
const [isSaved, setIsSaved] = useState(post.is_saved_by_user || false);
const [showReportModal, setShowReportModal] = useState(false);
const [showOptionsMenu, setShowOptionsMenu] = useState(false);
const [showShareModal, setShowShareModal] = useState(false);
const [showSimpleShareModal, setShowSimpleShareModal] = useState(false);
const [showShareToUsersModal, setShowShareToUsersModal] = useState(false);
const [videoLoaded, setVideoLoaded] = useState(false);
const [videoError, setVideoError] = useState(false);
const [thumbnailError, setThumbnailError] = useState(false);
const [isFollowing, setIsFollowing] = useState(post.is_following || false);
const [followLoading, setFollowLoading] = useState(false);
const [generatedThumbnail, setGeneratedThumbnail] = useState(null);
const [imageDimensions, setImageDimensions] = useState(null);
const dimensionCache = useRef({});
const [lastTap, setLastTap] = useState(0);
const [showHeartAnimation, setShowHeartAnimation] = useState(false);
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
const [showCommentsModal, setShowCommentsModal] = useState(false);
const [commentCount, setCommentCount] = useState(post.comments || post.comments_count || 0);
const [isBlocked, setIsBlocked] = useState(post.is_blocked || false);
const [sharesCount, setSharesCount] = useState(post.shares_count || post.shares || 0);

// Track restaurant post click for analytics
const trackRestaurantPostClick = async () => {
  if (post.account_type === 'restaurant') {
    try {
      const token = await AsyncStorage.getItem('token');
      axios.post(`${API_URL}/restaurant/analytics/track`, {
        restaurant_id: post.user_id,
        event_type: 'post_click',
        post_id: post.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    } catch (err) {
    }
  }
};

// Update isFollowing state when post data changes
useEffect(() => {
setIsFollowing(post.is_following || false);
}, [post.is_following]);

const mediaUrl = normalizeMediaUrl(post.media_url);

// Check if this is the current user's own post
const isOwnPost = user?.id === post.user_id;
const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;

const isVideo =
post.media_type === "video" || mediaUrl?.toLowerCase().endsWith(".mp4");

useEffect(() => {
  const generateThumbnail = async () => {
    if (isVideo && !thumbnailUrl && mediaUrl && !generatedThumbnail) {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(mediaUrl, {
          time: 1000,
          quality: 1.0,
        });
        setGeneratedThumbnail(uri);
      } catch (e) {
      }
    }
  };
  generateThumbnail();
}, [isVideo, thumbnailUrl, mediaUrl]);

const dpRaw = normalizeProfilePicture(post.user_profile_picture);

// Handle mute toggle
const handleMutePress = () => {
  if (onMuteToggle) {
    onMuteToggle(!isMuted);
  }
};

// Control video playback based on shouldPlay prop (iOS compatible)
useEffect(() => {
  if (!isVideo || !videoRef.current) return;

  const controlVideo = async () => {
    try {
      // Get current status to check if video is loaded
      const status = await videoRef.current.getStatusAsync();

      if (shouldPlay) {
        // For iOS, ensure video is loaded before playing
        if (status.isLoaded) {
          if (!status.isPlaying) {
            await videoRef.current.playAsync();
          }
          // Set mute state based on global state
          await videoRef.current.setIsMutedAsync(isMuted);
        } else {
          // If not loaded, wait a bit and try again (iOS sometimes needs this)
          setTimeout(async () => {
            try {
              const newStatus = await videoRef.current.getStatusAsync();
              if (newStatus.isLoaded && !newStatus.isPlaying) {
                await videoRef.current.playAsync();
                await videoRef.current.setIsMutedAsync(isMuted);
              }
            } catch (err) {
            }
          }, 300);
        }
      } else {
        // FULLY STOP video when not visible - pause, stop audio, and reset position
        if (status.isLoaded) {
          try {
            // First pause the video
            if (status.isPlaying) {
              await videoRef.current.pauseAsync();
            }
            // Reset video position to beginning to stop audio completely
            await videoRef.current.setPositionAsync(0);
            // Mute to ensure no audio plays
            await videoRef.current.setIsMutedAsync(true);
          } catch (err) {
          }
        }
      }
    } catch (error) {
    }
  };

  // Small delay to ensure video component is ready (especially on iOS)
  const timer = setTimeout(() => {
    controlVideo();
  }, 100);

  return () => {
    clearTimeout(timer);
    // Cleanup: Ensure video is stopped when component unmounts or shouldPlay changes
    if (videoRef.current && !shouldPlay) {
      videoRef.current.pauseAsync().catch(() => { });
      videoRef.current.setPositionAsync(0).catch(() => { });
    }
  };
}, [shouldPlay, isVideo, videoLoaded]);

// Update mute state when isMuted prop changes
useEffect(() => {
  if (!isVideo || !videoRef.current || !shouldPlay) return;

  const updateMuteState = async () => {
    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isLoaded) {
        await videoRef.current.setIsMutedAsync(isMuted);
      }
    } catch (err) {
    }
  };

  updateMuteState();
}, [isMuted, shouldPlay, isVideo]);

const handleLike = async () => {
  const prev = isLiked;
  setIsLiked(!prev);
  setLikes(prev ? likesCount - 1 : likesCount + 1);
  try {
    if (prev) {
      await unlikePost(post.id, post.account_type);  // ← Pass account_type
    } else {
      await likePost(post.id, post.account_type);    // ← Pass account_type
    }
  } catch {
    setIsLiked(prev);
    setLikes(likesCount);
  }
};

const handleSave = async () => {
const prev = isSaved;
setIsSaved(!prev);
try {
prev ? await unsavePost(post.id) : await savePost(post.id);
} catch {
setIsSaved(prev);
}
};

const handleOpenMap = () => {
if (post.map_link) {
Linking.openURL(post.map_link);
} else if (post.location_name) {
Linking.openURL(
`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
post.location_name
)}`
);
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
onPress: () => { },
},
{
text: "Follow",
onPress: async () => {
setFollowLoading(true);
const previousFollowState = isFollowing;
setIsFollowing(true);

try {
await followUser(post.user_id, post.account_type);
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
await unfollowUser(post.user_id, post.account_type);
} catch (error) {
console.error("Error unfollowing user:", error);
setIsFollowing(previousFollowState);
Alert.alert("Error", "Failed to unfollow user. Please try again.");
} finally {
setFollowLoading(false);
}
}
};

// Keep the simple block handler - no unblock in FeedCard
const handleBlockUser = async () => {
  if (!post.user_id || isOwnPost) return;

  Alert.alert(
    "Block User",
    `Are you sure you want to block ${post.username || "this user"}? You won't see their posts anywhere in the app.`,
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(post.user_id);
            Alert.alert(
              "Success", 
              `${post.username || "User"} has been blocked. You can unblock them from Settings > Blocked Users.`
            );
            // Optionally: trigger a feed refresh or remove the post from view
            // You could call a parent callback here to refresh the feed
          } catch (error) {
            console.error("Error blocking user:", error);
            Alert.alert("Error", "Failed to block user. Please try again.");
          }
        },
      },
    ]
  );
};

const handleDoubleTap = () => {
  const now = Date.now();
  const DOUBLE_TAP_DELAY = 300;

  if (now - lastTap < DOUBLE_TAP_DELAY) {
    if (!isLiked) {
      handleLike();
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
    // Single tap - track post click for restaurants
    trackRestaurantPostClick();
  }
  setLastTap(now);
};

return (
<View style={styles.card}>
{/* HEADER - Only show above media for images */}
{!isVideo && (
<View style={styles.userHeader}>
<TouchableOpacity
style={styles.userInfo}
onPress={() => {
  // Track profile view for restaurant
  if (post.account_type === 'restaurant') {
    AsyncStorage.getItem('token').then(token => {
      axios.post(`${API_URL}/restaurant/analytics/track`, {
        restaurant_id: post.user_id,
        event_type: 'profile_view'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    });
  }
  router.push(`/profile?userId=${post.user_id}`);
}}
>
<UserAvatar
profilePicture={dpRaw}
username={post.username}
size={36}
level={post.user_level}
showLevelBadge
/>
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
  <Text style={styles.username}>{post.username}</Text>
  {post.user_badge === 'verified' && (
    <CofauVerifiedBadge size={16} />
  )}
  {post.account_type === 'restaurant' && (
    <Ionicons name="storefront" size={14} color="#FF2E2E" />
  )}
</View>
</TouchableOpacity>

<View style={styles.headerRight}>
{/* Follow Button - Only show if not following and not own post */}
{!isOwnPost && !isFollowing && (
<TouchableOpacity
onPress={handleFollowToggle}
disabled={followLoading}
>
<LinearGradient
colors={["#FF2E2E", "#FF7A18"]}
start={{ x: 0, y: 0 }}
end={{ x: 1, y: 1 }}
style={styles.followButton}
>
<Text style={styles.followButtonText}>
{followLoading ? "..." : "Follow"}
</Text>
</LinearGradient>
</TouchableOpacity>
)}

{/* Three Dots Menu */}
<TouchableOpacity
style={styles.optionsButton}
onPress={() => setShowOptionsMenu(!showOptionsMenu)}
>
<Ionicons name="ellipsis-vertical" size={14} color="#333" />
</TouchableOpacity>
</View>
</View>
)}

{/* Options Menu Modal */}
{showOptionsMenu && (
  <View style={styles.optionsMenuOverlay}>
    {/* Block User Option - Only show if not own post */}
    {!isOwnPost && (
      <TouchableOpacity
        style={styles.optionsMenuItem}
        onPress={() => {
          setShowOptionsMenu(false);
          handleBlockUser();
        }}
      >
        <Ionicons name="ban-outline" size={20} color="#FF6B6B" />
        <Text style={[styles.optionsMenuText, { color: '#FF6B6B' }]}>
          Block User
        </Text>
      </TouchableOpacity>
    )}
    
    {/* Report Post Option */}
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
)}

{/* Report Modal */}
<ReportModal
visible={showReportModal}
onClose={() => setShowReportModal(false)}
postId={post.id}
/>

{/* MEDIA */}
{!!mediaUrl && (
  <Pressable 
    style={isVideo ? styles.videoWrapper : null}
    onPress={handleDoubleTap}
  >
    {isVideo ? (
      <>
        {/* VIDEO OVERLAY HEADER - Inside video container */}
        <View style={styles.videoOverlayHeader}>
          <TouchableOpacity
            style={styles.videoUserInfo}
            onPress={() => {
  // Track profile view for restaurant
  if (post.account_type === 'restaurant') {
    AsyncStorage.getItem('token').then(token => {
      axios.post(`${API_URL}/restaurant/analytics/track`, {
        restaurant_id: post.user_id,
        event_type: 'profile_view'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    });
  }
  router.push(`/profile?userId=${post.user_id}`);
}}
          >
            <UserAvatar
              profilePicture={dpRaw}
              username={post.username}
              size={32}
              level={post.user_level}
              showLevelBadge
            />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
  <Text style={styles.videoUsername}>{post.username}</Text>
  {post.user_badge === 'verified' && (
    <CofauVerifiedBadge size={14} />
  )}
  {post.account_type === 'restaurant' && (
    <Ionicons name="storefront" size={14} color="#fff" />
  )}
</View>

            {!isOwnPost && !isFollowing && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleFollowToggle();
                }}
                disabled={followLoading}
              >
                <LinearGradient
                  colors={["#FF2E2E", "#FF7A18"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.videoFollowButton}
                >
                  <Text style={styles.videoFollowButtonText}>
                    {followLoading ? "..." : "Follow"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.videoOptionsButton}
            onPress={(e) => {
              e.stopPropagation();
              setShowOptionsMenu(!showOptionsMenu);
            }}
          >
            <Ionicons name="ellipsis-vertical" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Thumbnail - Show when video is not preloaded */}
        {(!shouldPlay || !videoLoaded) && (
          <View style={[styles.video, styles.videoPlaceholder]}>
            <Image
              source={{ uri: thumbnailUrl || generatedThumbnail || mediaUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              blurRadius={0}
            />
            <View style={styles.playIconContainer}>
              <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.7)" />
            </View>
          </View>
        )}

        {/* Video - Only render when shouldPlay is true and no error */}
        {shouldPlay && !videoError && (
          <Video
            key="video"
            ref={videoRef}
            source={{
              uri: mediaUrl,
              // iOS requires headers for proper video loading
              headers: {
                'Accept': 'video/mp4, video/quicktime, video/*',
                'User-Agent': 'Cofau/1.0',
              }
            }}
            style={styles.video}
            resizeMode="contain"
            shouldPlay={shouldPlay}
            isLooping
            isMuted={isMuted}
            useNativeControls={false}
            allowsExternalPlayback={false}
            playInSilentModeIOS={true}
            // iOS-specific props for better compatibility
            usePoster={false}
            posterSource={null}
            videoStyle={{ backgroundColor: 'black' }} 
            // Preload video for iOS
            onLoad={(status) => {
              // Only update state if it changed to prevent flickering
              if (!videoLoaded) {
                setVideoLoaded(true);
              }
              if (videoError) {
                setVideoError(false);
              }
              // Ensure video plays after load (iOS needs explicit play)
              if (shouldPlay && videoRef.current) {
                setTimeout(async () => {
                  try {
                    const currentStatus = await videoRef.current.getStatusAsync();
                    if (currentStatus.isLoaded && !currentStatus.isPlaying && shouldPlay) {
                      // iOS needs explicit play call
                      await videoRef.current.playAsync();
                      // Set mute state
                      await videoRef.current.setIsMutedAsync(isMuted);
                      // Ensure it's actually playing
                      const afterPlayStatus = await videoRef.current.getStatusAsync();
                      if (!afterPlayStatus.isPlaying && shouldPlay) {
                        // Retry play if it didn't start
                        setTimeout(async () => {
                          try {
                            await videoRef.current.playAsync();
                          } catch (retryErr) {
                          }
                        }, 300);
                      }
                    }
                  } catch (err) {
                  }
                }, 200); // Reduced delay to prevent flickering
              }
            }}
            onError={(error) => {
              console.error("❌ Video error:", error);
              console.error("❌ Video URL:", mediaUrl);
              if (!videoError) {
                setVideoError(true);
              }
              if (videoLoaded) {
                setVideoLoaded(false);
              }
            }}
            onPlaybackStatusUpdate={(status) => {
              // Ensure video stops if shouldPlay becomes false
              if (!shouldPlay && status.isLoaded && status.isPlaying && videoRef.current) {
                videoRef.current.pauseAsync().catch(() => { });
                videoRef.current.setPositionAsync(0).catch(() => { });
              }
              // Only attempt to play if video is loaded and should play
              if (status.isLoaded && !status.isPlaying && shouldPlay && videoLoaded) {
                videoRef.current?.playAsync().catch((err) => {
                  // Silently handle - don't log to prevent spam
                });
              }
            }}
            progressUpdateIntervalMillis={1000}
          />
        )}
        
        {/* iOS HDR Brightness Fix - Semi-transparent overlay */}
        {Platform.OS === 'ios' && shouldPlay && (
          <View 
            style={styles.hdrOverlay} 
            pointerEvents="none" 
          />
        )}
        
        {/* Mute/Unmute Button - Bottom right corner, only show when video is playing */}
        {shouldPlay && videoLoaded && !videoError && (
          <TouchableOpacity
            style={styles.muteButton}
            onPress={(e) => {
              e.stopPropagation();
              handleMutePress();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.muteButtonBackground}>
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={18}
                color="#fff"
              />
            </View>
          </TouchableOpacity>
        )}
      </>
    ) : (
      mediaUrl ? (
        <Image
          source={{ uri: mediaUrl }}
          style={[
            styles.image,
            imageDimensions && { aspectRatio: imageDimensions.width / imageDimensions.height }
          ]}
          resizeMode="cover"
          onLoad={(e) => {
            if (!dimensionCache.current[mediaUrl]) {
              const { width, height } = e.nativeEvent.source;
              dimensionCache.current[mediaUrl] = { width, height };
              setImageDimensions({ width, height });
            }
          }}
          onError={(error) => {
            console.error("❌ Image load error in FeedCard:", mediaUrl, error);
            console.error("❌ Post account_type:", post.account_type);
            console.error("❌ Original post.media_url:", post.media_url);
            console.error("❌ Original post.image_url:", post.image_url);
          }}
          onLoadStart={() => {
          }}
        />
      ) : (
        <View style={[styles.image, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', aspectRatio: 0.75 }]}>
          <Ionicons name="image-outline" size={40} color="#ccc" />
          <Text style={{ color: '#999', fontSize: 10, marginTop: 4 }}>No image</Text>
        </View>
      )
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
          {confettiAnims.map((c, i) => (
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

    {/* Restaurant Tag Overlay - Must be inside Pressable to show on image */}
    {post.tagged_restaurant && post.tagged_restaurant.restaurant_name ? (
      <TouchableOpacity
        style={styles.restaurantTagOverlay}
        onPress={() => router.push(`/profile?userId=${post.tagged_restaurant.id}`)}
        activeOpacity={0.8}
      >
        <Ionicons name="storefront" size={12} color="#FFF" />
        <Text style={styles.restaurantTagText} numberOfLines={1}>
          {post.tagged_restaurant.restaurant_name}
        </Text>
      </TouchableOpacity>
    ) : null}

    {/* Dish Name Overlay - Bottom left */}
    {post.dish_name ? (
      <TouchableOpacity
        style={styles.dishNameOverlay}
        activeOpacity={0.7}
        onPress={(e) => {
          e.stopPropagation();
          router.push({ pathname: "/search-results", params: { query: post.dish_name } });
        }}
      >
        <Text style={styles.dishNameOverlayText} numberOfLines={1}>
          {post.dish_name.toUpperCase()}
        </Text>
      </TouchableOpacity>
    ) : null}
  </Pressable>
)}

{/* ALL-IN-ONE GLASS CARD */}
{(post.rating != null || post.price || post.description || post.about || post.location_name || post.location_address) && (
  <View style={styles.glassCardShadow}>
    <View style={styles.glassCardClipper}>
    <BlurView intensity={100} tint="default" style={styles.glassCard}>
      <View style={styles.glassCardInner}>

        {/* RATING */}
        {post.rating != null && !post.price && (
          <View style={styles.glassSection}>
            <Text style={styles.detailLabel}>RATING</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={19} color="#FFD700" />
              <Text style={styles.ratingText}>
                <Text style={styles.ratingNumber}>{post.rating}</Text>/10
              </Text>
            </View>
          </View>
        )}

        {/* PRICE */}
        {post.price && (
          <View style={styles.glassSection}>
            <Text style={styles.detailLabel}>PRICE</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="pricetag" size={19} color="#FFD700" />
              <Text style={styles.ratingText}>{post.price}</Text>
            </View>
          </View>
        )}

        {/* REVIEW / ABOUT */}
        {(post.description || post.about) && (
          <View style={styles.glassSection}>
            <Text style={styles.detailLabel}>
              {post.price ? 'ABOUT' : 'REVIEW'}
            </Text>
            <View style={styles.reviewRow}>
              <Ionicons
                name={post.price ? "information-circle" : "create"}
                size={19}
                color="#FFD700"
              />
              <Text style={styles.reviewText}>
                {post.about || post.description}
              </Text>
            </View>
          </View>
        )}

        {/* LOCATION */}
        {(post.location_name || post.location_address) && (
          <View style={[styles.glassSection, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>LOCATION</Text>
              <Pressable onPress={handleOpenMap} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <LinearGradient
                colors={['rgba(255,46,46,0.10)', 'rgba(255,122,24,0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.locationGradientWrap}
              >
                <Ionicons name="location" size={18} color="#FF2E2E" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {post.location_name || post.location_address}
                </Text>
                <View style={{ flex: 1 }} />
                <View style={styles.locationArrowButton}>
                  <Ionicons name="chevron-forward" size={14} color="#fff" />
                </View>
              </LinearGradient>
              </Pressable>
            </View>
        )}

      </View>
    </BlurView>
    </View>
  </View>
)}

{/* ENGAGEMENT ICONS - below the glass card */}
<View style={styles.engagementRow}>
  <TouchableOpacity onPress={handleLike} style={styles.engagementBtn}>
    <View style={styles.engagementIcon}>
      {isLiked ? (
        <GradientHeart size={18} />
      ) : (
        <Ionicons name="heart-outline" size={18} color="#888" />
      )}
    </View>
    <Text style={[styles.engagementCount, isLiked && { color: '#FF2E2E' }]}>{likesCount}</Text>
  </TouchableOpacity>

  <TouchableOpacity onPress={() => setShowCommentsModal(true)} style={styles.engagementBtn}>
    <View style={styles.engagementIcon}>
      <Ionicons name="chatbubble-outline" size={17} color="#888" />
    </View>
    <Text style={styles.engagementCount}>{commentCount}</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.engagementBtn}
    onPress={() => {
      Alert.alert(
        "Share Post",
        "Choose how you want to share",
        [
          {
            text: "Add to Story",
            onPress: async () => {
              try {
                await addPostToStory(
                  post.id,
                  mediaUrl,
                  post.description || post.review_text || "",
                  post.rating || 0,
                  post.location_name || ""
                );
                setSharesCount(prev => prev + 1);
                incrementShareCount(post.id);
                Alert.alert(
                  "Successfully Added!",
                  "Post has been added to your story",
                  [{ text: "OK", onPress: () => { if (onStoryCreated) onStoryCreated(); } }]
                );
              } catch (error) {
                console.error("Error adding post to story:", error);
                Alert.alert("Error", error.response?.data?.detail || "Failed to add post to story. Please try again.");
              }
            },
          },
          { text: "Add to Instagram Story", onPress: () => { setShowSimpleShareModal(true); setSharesCount(prev => prev + 1); incrementShareCount(post.id); } },
          { text: "Share to Cofau Users", onPress: () => setShowShareToUsersModal(true) },
          { text: "More Options", onPress: () => { setShowSimpleShareModal(true); setSharesCount(prev => prev + 1); incrementShareCount(post.id); } },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }}
  >
    <View style={styles.engagementIcon}>
      <Ionicons name="arrow-redo-outline" size={18} color="#888" />
    </View>
    <Text style={styles.engagementCount}>{sharesCount}</Text>
  </TouchableOpacity>

  <TouchableOpacity style={styles.engagementBtn} onPress={handleSave}>
    <View style={styles.engagementIcon}>
      {isSaved ? (
        <GradientBookmark size={18} />
      ) : (
        <Ionicons name="bookmark-outline" size={18} color="#888" />
      )}
    </View>
  </TouchableOpacity>
</View>

{/* Share to Users Modal (Cofau) */}
<ShareToUsersModal
visible={showShareToUsersModal}
onClose={() => setShowShareToUsersModal(false)}
post={post}
onShare={async (userIds) => {
try {
await sharePostToUsers(post.id, userIds);
setSharesCount(prev => prev + 1);
incrementShareCount(post.id);
Alert.alert("Success", `Post shared to ${userIds.length} user(s)`);
} catch (error) {
Alert.alert("Error", "Failed to share post. Please try again.");
console.error("Error sharing post:", error);
}
}}
/>

{/* Comments Modal */}
<CommentsModal
  postId={post.id}
  isVisible={showCommentsModal}
  onClose={() => setShowCommentsModal(false)}
  accountType={post.account_type}
  onCommentCountChange={setCommentCount}
/>

{/* Simple Share Modal (WhatsApp/Instagram) */}
<SimpleShareModal
visible={showSimpleShareModal}
onClose={() => setShowSimpleShareModal(false)}
post={post}
/>
</View>
);
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
card: {
  backgroundColor: "#fff",
  marginBottom: 2,
  elevation: 0,  // ← Just change this from 6 to 0
},

userHeader: {
flexDirection: "row",
padding: 8,
alignItems: "center",
justifyContent: "space-between",
borderTopWidth: 0,  // ← Add this to remove top border
borderTopColor: 'transparent',  // ← Add this for safety
},

userInfo: {
flexDirection: "row",
alignItems: "center",
gap: 6,
},

videoWrapper: {
  position: "relative",
  width: "100%",
  overflow: 'hidden',
  backgroundColor: '#000',
},

headerRight: {
flexDirection: "row",
alignItems: "center",
gap: 0,
},

followButton: {
paddingHorizontal: 10,
paddingVertical: 4,
borderRadius: 12,
},

followButtonText: {
color: "#fff",
fontSize: 10,
fontWeight: "600",
},

username: {
fontSize: 14,
alignItems: "top",
fontWeight: "600",
color: "#333",
},

image: {
width: "100%",
aspectRatio: 0.75, // Default aspect ratio while loading
backgroundColor: '#f9f9f9',
},

video: {
width: "100%",
aspectRatio: 9 / 16,
backgroundColor: '#000',
},

hiddenImage: {
position: "absolute",
opacity: 0,
width: "100%",
height: "100%",
zIndex: 0,
},

videoPlaceholder: {
  backgroundColor: '#000',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
},

playIconContainer: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
},

hdrOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  zIndex: 5,
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
},

videoPlaceholderText: {
color: "#999",
fontSize: 14,
marginTop: 8,
},

playIconBackground: {
width: 70,
height: 70,
borderRadius: 35,
backgroundColor: "rgba(0, 0, 0, 0.6)",
justifyContent: "center",
alignItems: "center",
},

// Video overlay header styles
videoOverlayHeader: {
position: 'absolute',
top: 0,
left: 0,
right: 0,
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
paddingHorizontal: 12,
paddingTop: 12,
paddingBottom: 20,
zIndex: 10,
backgroundColor: 'transparent',
},

videoUserInfo: {
flexDirection: 'row',
alignItems: 'center',
gap: 8,
},

videoOptionsButton: {
  padding: 8,
},

restaurantTagOverlay: {
  position: 'absolute',
  bottom: 10,
  right: 10,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(233, 74, 55, 0.85)',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 6,
  maxWidth: '55%',
  gap: 4,
  zIndex: 20,
},
restaurantTagText: {
  color: '#FFF',
  fontSize: 10,
  fontWeight: '600',
},

dishNameOverlay: {
  position: 'absolute',
  bottom: 10,
  left: 10,
  backgroundColor: 'rgba(233, 74, 55, 0.85)',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 6,
  maxWidth: '55%',
  zIndex: 20,
},
dishNameOverlayText: {
  color: '#FFF',
  fontSize: 10,
  fontWeight: '600',
},

// Mute button styles
muteButton: {
  position: 'absolute',
  bottom: 16,
  right: 16,
  zIndex: 15,
},

muteButtonBackground: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},

videoUsername: {
fontSize: 14,
fontWeight: '600',
color: '#fff',
textShadowColor: 'rgba(0, 0, 0, 0.75)',
textShadowOffset: { width: 1, height: 1 },
textShadowRadius: 3,
},

videoFollowButton: {
paddingHorizontal: 12,
paddingVertical: 2.5,
borderRadius: 6,
marginLeft: 180,
},

videoFollowButtonText: {
color: '#fff',
fontSize: 10,
fontWeight: '600',
},

detailsContainer: {
padding: 8,
paddingBottom: 0,
},

detailBox: {
backgroundColor: "#FFFFFF",
borderRadius: 0,
padding: 14,
marginBottom: 10,
borderColor: "#DADCE0",
shadowColor: "#000",
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.1,
shadowRadius: 2,
elevation: 2,
borderWidth: 0,
},

detailLabel: {
fontSize: 11,
fontWeight: "600",
color: "#666",
marginBottom: 4,
letterSpacing: 0.5,
textTransform: "uppercase",
},

ratingRow: {
flexDirection: "row",
alignItems: "center",
gap: 6,
},

ratingText: {
fontSize: 15,
fontWeight: "500",
color: "#000",
},

ratingNumber: {
fontWeight: "500",
fontSize: 15,
color: "#000",
},

reviewRow: {
flexDirection: "row",
gap: 8,
},

reviewText: {
fontSize: 16,
fontWeight: "500",
color: "#000",
flex: 1,
},

locationBox: {
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: 'rgba(255, 46, 46, 0.15)',
},

locationButton: {
  borderRadius: 25,
  paddingVertical: 14,
  paddingHorizontal: 20,
  marginBottom: 10,
  shadowColor: '#FF2E2E',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
},

locationArrowButton: {
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: '#FF2E2E',
  justifyContent: 'center',
  alignItems: 'center',
},

locationButtonContent: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},

locationButtonText: {
  flex: 1,
  fontSize: 15,
  fontWeight: '600',
  color: '#fff',
},

locationArrowCircle: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
},

locationBoxWrapper: {
  borderRadius: 12,
  marginBottom: 10,
  overflow: 'hidden',
},

locationBoxPressed: {
  transform: [{ scale: 0.97 }],
  opacity: 0.9,
},

locationRow: {
flexDirection: "row",
alignItems: "center",
gap: 7,
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

locationText: {
fontSize: 15,
fontWeight: "500",
color: "#000",
},

actions: {
flexDirection: "row",
alignItems: "center",
paddingHorizontal: 12,
paddingVertical: 12,
borderTopWidth: 1,
borderTopColor: "#F0F0F0",
},

actionButton: {
flexDirection: "row",
alignItems: "center",
marginRight: 24,
gap: 6,
},

actionCount: {
fontSize: 12,
color: "#202124",
fontWeight: "700",
},

likedCount: {
color: "#090302ff",
fontWeight: "600",
},
optionsButton: {
padding: 4,
marginLeft: 'auto',
},
optionsMenuBackdrop: {
position: 'absolute',
top: 0,
left: 0,
right: 0,
bottom: 0,
zIndex: 999,
},
optionsMenuOverlay: {
position: 'absolute',
top: 60,
right: 16,
backgroundColor: '#FFF',
borderRadius: 12,
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.25,
shadowRadius: 8,
elevation: 5,
zIndex: 1000,
minWidth: 150,
},
optionsMenuItem: {
flexDirection: 'row',
alignItems: 'center',
padding: 16,
gap: 8,
},
optionsMenuText: {
fontSize: 16,
color: '#333',
fontWeight: '500',
},

// ─── Glass Card (all-in-one) ───
glassCardShadow: {
  marginHorizontal: 10,
  marginTop: 10,
  marginBottom: 4,
  borderRadius: 20,
  backgroundColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.15,
  shadowRadius: 16,
  elevation: 6,
},
glassCardClipper: {
  borderRadius: 20,
  overflow: 'hidden',
},
glassCard: {
  overflow: 'hidden',
  backgroundColor: 'rgba(255, 255, 255, 0.93)',
},
glassCardInner: {
  padding: 14,
  gap: 0,
},
glassSection: {
  paddingVertical: 10,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: 'rgba(0, 0, 0, 0.06)',
},

locationGradientWrap: {
  flexDirection: 'row',
  alignItems: 'center',
  borderRadius: 12,
  paddingVertical: 10,
  paddingHorizontal: 12,
  gap: 8,
},

// ─── Engagement Icons ───
engagementRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 8,
  paddingHorizontal: 16,
  gap: 16,
},
engagementBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
engagementIcon: {
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: '#F3F3F3',
  justifyContent: 'center',
  alignItems: 'center',
},
engagementCount: {
  fontSize: 12,
  fontWeight: '700',
  color: '#333',
},
});

export default React.memo(FeedCard, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.shouldPlay === nextProps.shouldPlay &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.post.is_liked === nextProps.post.is_liked &&
    prevProps.post.is_saved_by_user === nextProps.post.is_saved_by_user
  );
});