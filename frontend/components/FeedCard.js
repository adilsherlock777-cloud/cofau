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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

import UserAvatar from "./UserAvatar";
import SharePreviewModal from "./SharePreviewModal";
import ShareToUsersModal from "./ShareToUsersModal";
import SimpleShareModal from "./SimpleShareModal";
import ReportModal from "./ReportModal";
import { useAuth } from "../context/AuthContext";
import {
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  reportPost,
  sharePostToUsers,
  addPostToStory,
  followUser,
  unfollowUser,
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
      colors={["#E94A37", "#F2CF68", "#1B7C82"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

export default function FeedCard({
  post,
  onLikeUpdate,
  onStoryCreated,
  showOptionsMenuProp = true,
  shouldPlay = false,
}) {
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

  const mediaUrl = normalizeMediaUrl(post.media_url);

  // Check if this is the current user's own post
  const isOwnPost = user?.id === post.user_id;
  const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
  const isVideo =
    post.media_type === "video" || mediaUrl?.toLowerCase().endsWith(".mp4");

  const dpRaw = normalizeProfilePicture(post.user_profile_picture);

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
          } else {
            // If not loaded, wait a bit and try again (iOS sometimes needs this)
            setTimeout(async () => {
              try {
                const newStatus = await videoRef.current.getStatusAsync();
                if (newStatus.isLoaded && !newStatus.isPlaying) {
                  await videoRef.current.playAsync();
                }
              } catch (err) {
                console.log("Video play retry error:", err);
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
              console.log("Video stop error:", err);
            }
          }
        }

        // When video should play, ensure it's unmuted (if it was muted when paused)
        if (shouldPlay && status.isLoaded) {
          try {
            // Unmute when playing (videos in feed are muted by default but we want to ensure state is correct)
            await videoRef.current.setIsMutedAsync(true); // Keep muted in feed as per design
          } catch (err) {
            // Ignore mute errors
          }
        }
      } catch (error) {
        console.log("Video playback control error:", error);
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

  // Reset error state when shouldPlay changes
  useEffect(() => {
    if (shouldPlay) {
      setVideoError(false);
    }
  }, [shouldPlay]);

  // Cleanup: Ensure video is fully stopped when component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current && isVideo) {
        // Stop video completely on unmount
        videoRef.current.pauseAsync().catch(() => { });
        videoRef.current.setPositionAsync(0).catch(() => { });
        videoRef.current.setIsMutedAsync(true).catch(() => { });
      }
    };
  }, [isVideo]);

  const handleLike = async () => {
    const prev = isLiked;
    setIsLiked(!prev);
    setLikes(prev ? likesCount - 1 : likesCount + 1);
    try {
      prev ? await unlikePost(post.id) : await likePost(post.id);
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

    setFollowLoading(true);
    const previousFollowState = isFollowing;
    setIsFollowing(!isFollowing);

    try {
      if (isFollowing) {
        await unfollowUser(post.user_id);
      } else {
        await followUser(post.user_id);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      setIsFollowing(previousFollowState);
      Alert.alert("Error", "Failed to update follow status. Please try again.");
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.userHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
        >
          <UserAvatar
            profilePicture={dpRaw}
            username={post.username}
            size={36}
            level={post.user_level}
            showLevelBadge
          />
          <Text style={styles.username}>{post.username}</Text>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Follow Button - Only show if not following and not own post */}
          {!isOwnPost && !isFollowing && (
            <TouchableOpacity
              style={styles.followButton}
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              <Text style={styles.followButtonText}>
                {followLoading ? "..." : "Follow"}
              </Text>
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

      {/* Options Menu Modal */}
      {showOptionsMenu && (
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
      )}

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={post.id}
      />

      {/* MEDIA */}
      {!!mediaUrl && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/post-details/${post.id}`)}
        >
          {isVideo ? (
            <>
              {shouldPlay && !videoError ? (
                <Video
                  ref={videoRef}
                  source={{ uri: mediaUrl }}
                  style={styles.video}
                  resizeMode="cover"
                  shouldPlay={shouldPlay}
                  isLooping
                  isMuted={true}
                  useNativeControls={false}
                  allowsExternalPlayback={false}
                  playInSilentModeIOS={true}
                  onLoad={(status) => {
                    console.log("✅ Video loaded on iOS/Android", status);
                    setVideoLoaded(true);
                    setVideoError(false);
                    // Ensure video plays after load (iOS needs explicit play)
                    if (shouldPlay && videoRef.current) {
                      setTimeout(async () => {
                        try {
                          const currentStatus = await videoRef.current.getStatusAsync();
                          if (currentStatus.isLoaded && !currentStatus.isPlaying && shouldPlay) {
                            await videoRef.current.playAsync();
                          }
                        } catch (err) {
                          console.log("Auto-play error:", err);
                        }
                      }, 200);
                    }
                  }}
                  onError={(error) => {
                    console.error("❌ Video error:", error);
                    console.error("❌ Video URL:", mediaUrl);
                    setVideoError(true);
                    setVideoLoaded(false);
                    // Try to reload video on error (iOS sometimes needs this)
                    if (videoRef.current) {
                      setTimeout(() => {
                        videoRef.current?.reloadAsync().catch((reloadErr) => {
                          console.error("Reload error:", reloadErr);
                        });
                      }, 1000);
                    }
                  }}
                  onLoadStart={() => {
                    console.log("📹 Video loading started:", mediaUrl);
                    setVideoError(false);
                  }}
                  onPlaybackStatusUpdate={(status) => {
                    // Ensure video stops if shouldPlay becomes false
                    if (!shouldPlay && status.isLoaded && status.isPlaying && videoRef.current) {
                      videoRef.current.pauseAsync().catch(() => { });
                      videoRef.current.setPositionAsync(0).catch(() => { });
                    }
                  }}
                  progressUpdateIntervalMillis={1000}
                />
              ) : (
                <>
                  {!thumbnailError ? (
                    <Image
                      source={{ uri: thumbnailUrl || mediaUrl }}
                      style={styles.image}
                      onError={() => {
                        console.error("❌ Thumbnail error");
                        setThumbnailError(true);
                      }}
                    />
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <Ionicons name="videocam-outline" size={40} color="#999" />
                      <Text style={styles.videoPlaceholderText}>Video</Text>
                    </View>
                  )}
                </>
              )}
              {!shouldPlay && !videoError && (
                <View style={styles.playIconOverlay}>
                  <Ionicons name="play-circle-outline" size={60} color="#fff" />
                </View>
              )}
            </>
          ) : (
            mediaUrl ? (
              <Image 
                source={{ uri: mediaUrl }} 
                style={styles.image}
                onError={(error) => {
                  console.error("❌ Image load error in FeedCard:", mediaUrl, error);
                }}
                onLoadStart={() => {
                  console.log("🖼️ Loading image:", mediaUrl);
                }}
              />
            ) : (
              <View style={[styles.image, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={40} color="#ccc" />
              </View>
            )
          )}
        </TouchableOpacity>
      )}

      {/* DETAILS */}
      <View style={styles.detailsContainer}>
        {/* RATING */}
        {post.rating != null && (
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>RATING</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={19} color="#FFD700" />
              <Text style={styles.ratingText}>
                <Text style={styles.ratingNumber}>{post.rating}</Text>/10
              </Text>
            </View>
          </View>
        )}

        {/* REVIEW */}
        {post.description && (
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>REVIEW</Text>
            <View style={styles.reviewRow}>
              <Ionicons name="create" size={19} color="#FFD700" />
              <Text style={styles.reviewText}>{post.description}</Text>
            </View>
          </View>
        )}

        {/* LOCATION */}
        {(post.location_name || post.location_address) && (
          <TouchableOpacity
            style={[styles.detailBox, styles.locationBox]}
            onPress={handleOpenMap}
            activeOpacity={0.85}
          >
            <Text style={styles.detailLabel}>LOCATION</Text>

            <View style={styles.locationRow}>
              <Ionicons
                name="location"
                size={19}
                color="#FFD700" // ✅ GOLD ICON
              />

              <Text style={styles.locationText}>
                {post.location_name}
              </Text>

              <View style={{ flex: 1 }} />

              <Ionicons
                name="chevron-forward"
                size={18}
                color="#999"
              />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ACTIONS */}
      <View style={styles.actions}>
        {/* LIKE */}
        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
          {isLiked ? (
            <GradientHeart size={22} /> // ✅ COFAU GRADIENT RESTORED
          ) : (
            <Ionicons name="heart-outline" size={22} color="#666" />
          )}
          <Text style={[styles.actionCount, isLiked && styles.likedCount]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        {/* COMMENT */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/comments/${post.id}`)}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#666" />
          <Text style={styles.actionCount}>{post.comments || 0}</Text>
        </TouchableOpacity>

        {/* SHARE */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // Show options: Add to Story, Share to Users (Cofau), or External (WhatsApp/Instagram)
            Alert.alert(
              "Share Post",
              "Choose how you want to share",
              [
                {
                  text: "Add to Story",
                  onPress: async () => {
                    try {
                      const mediaUrl = normalizeMediaUrl(post.media_url || post.image_url);
                      await addPostToStory(
                        post.id,
                        mediaUrl,
                        post.review_text || post.description || "",
                        post.rating || 0,
                        post.location_name || post.location || ""
                      );
                      Alert.alert("Success", "Post added to your story! 🎉");
                      if (onStoryCreated) {
                        onStoryCreated();
                      }
                    } catch (error) {
                      Alert.alert("Error", error.response?.data?.detail || "Failed to add to story. Please try again.");
                      console.error("Error adding to story:", error);
                    }
                  },
                },
                {
                  text: "Share to Cofau Users",
                  onPress: () => setShowShareToUsersModal(true),
                },
                {
                  text: "Share to WhatsApp/Instagram",
                  onPress: () => setShowSimpleShareModal(true),
                },
                {
                  text: "Cancel",
                  style: "cancel",
                },
              ]
            );
          }}
        >
          <Ionicons name="paper-plane-outline" size={22} color="#666" />
          <Text style={styles.actionCount}>{post.shares || 0}</Text>
        </TouchableOpacity>

        {/* SAVE */}
        <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={22}
            color={isSaved ? "#1B7C82" : "#666"}
          />
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
            Alert.alert("Success", `Post shared to ${userIds.length} user(s)`);
          } catch (error) {
            Alert.alert("Error", "Failed to share post. Please try again.");
            console.error("Error sharing post:", error);
          }
        }}
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
    elevation: 6,
  },

  userHeader: {
    flexDirection: "row",
    padding: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },

  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },

  followButton: {
    backgroundColor: "#1B7C82",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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

  videoContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 2,
    backgroundColor: "#000",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },

  video: {
    width: "100%",
    aspectRatio: 9 / 16,
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
  videoPlaceholder: {
    width: "100%",
    aspectRatio: 9 / 16,
    backgroundColor: "#000",
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
    fontWeight: "700",
    color: "#202124",
  },

  ratingNumber: {
    fontWeight: "700",
    fontSize: 15,
  },

  reviewRow: {
    flexDirection: "row",
    gap: 8,
  },

  reviewText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#202124",
    flex: 1,
  },

  locationBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 0,
    borderWidth: 0.2,
    borderColor: "#0e0e0dff",        // ✅ Change from #DADCE0 to cyan (more noticeable)
    shadowColor: "#000000ff",        // ✅ Add cyan shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 12,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  locationText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#202124",
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
});
