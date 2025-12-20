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

  const mediaUrl = normalizeMediaUrl(post.media_url);
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
            await videoRef.current.playAsync();
          } else {
            // If not loaded, wait a bit and try again (iOS sometimes needs this)
            setTimeout(async () => {
              try {
                const newStatus = await videoRef.current.getStatusAsync();
                if (newStatus.isLoaded) {
                  await videoRef.current.playAsync();
                }
              } catch (err) {
                console.log("Video play retry error:", err);
              }
            }, 300);
          }
        } else {
          // Pause video when not visible
          if (status.isLoaded) {
            await videoRef.current.pauseAsync();
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

    return () => clearTimeout(timer);
  }, [shouldPlay, isVideo, videoLoaded]);

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

        {/* Three Dots Menu */}
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => setShowOptionsMenu(!showOptionsMenu)}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
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
              {shouldPlay ? (
                <Video
                  ref={videoRef}
                  source={{ uri: mediaUrl }}
                  style={styles.video}
                  resizeMode="cover"
                  shouldPlay={true}
                  isLooping
                  isMuted={true}
                  useNativeControls={false}
                  allowsExternalPlayback={false}
                  playInSilentModeIOS={true}
                  onLoad={(status) => {
                    console.log("✅ Video loaded on iOS/Android", status);
                    setVideoLoaded(true);
                    // Ensure video plays after load (iOS needs explicit play)
                    if (shouldPlay && videoRef.current) {
                      setTimeout(async () => {
                        try {
                          const currentStatus = await videoRef.current.getStatusAsync();
                          if (currentStatus.isLoaded && !currentStatus.isPlaying) {
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
                    // Try to reload video on error (iOS sometimes needs this)
                    if (videoRef.current) {
                      setTimeout(() => {
                        videoRef.current?.reloadAsync().catch(console.error);
                      }, 1000);
                    }
                  }}
                  onLoadStart={() => {
                    console.log("📹 Video loading started:", mediaUrl);
                  }}
                  progressUpdateIntervalMillis={1000}
                />
              ) : (
                <Image source={{ uri: thumbnailUrl || mediaUrl }} style={styles.image} />
              )}
              {!shouldPlay && (
                <View style={styles.playIconOverlay}>
                  <Ionicons name="play-circle-outline" size={60} color="#fff" />
                </View>
              )}
            </>
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.image} />
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
            // Show options: Share to Users (Cofau) or External (WhatsApp/Instagram)
            Alert.alert(
              "Share Post",
              "Choose how you want to share",
              [
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
    marginBottom: -10,
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
    marginBottom: 1,
    borderWidth: 0.2,
    borderColor: "#0e0e0dff",        // ✅ Change from #DADCE0 to cyan (more noticeable)
    shadowColor: "#000000ff",        // ✅ Add cyan shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
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
    paddingHorizontal: 16,
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
    fontSize: 14,
    color: "#202124",
    fontWeight: "700",
  },

  likedCount: {
    color: "#090302ff",
    fontWeight: "600",
  },
  optionsButton: {
    padding: 8,
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
