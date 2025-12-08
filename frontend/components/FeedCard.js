import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Share, Platform, Alert, Modal, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Video } from "expo-av";
import axios from "axios";

import UserAvatar from "./UserAvatar";
import SharePreviewModal from "./SharePreviewModal";
import { useAuth } from "../context/AuthContext";
import { likePost, unlikePost, savePost, unsavePost, reportPost } from "../utils/api";
import { normalizeMediaUrl, normalizeProfilePicture, BACKEND_URL } from "../utils/imageUrlFix";

/* ----------------------------------------------------------
   ✅ EXTRACT CLEAN LOCATION FROM GOOGLE MAPS LINK
-----------------------------------------------------------*/
const extractLocationName = (mapLink) => {
  if (!mapLink) return null;

  try {
    const url = new URL(mapLink);
    const q = url.searchParams.get("q");
    if (q) return decodeURIComponent(q);
  } catch (e) {
    // fallback for malformed links
    const match = mapLink.match(/q=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }

  return "View Location";
};

/* ----------------------------------------------------------
   ✅ TIME AGO FORMATTER (replaces moment)
-----------------------------------------------------------*/
const getTimeAgo = (dateString) => {
  if (!dateString) return "Just now";

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    }
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
    if (diffInSeconds < 2592000) {
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks}w ago`;
    }
    if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months}mo ago`;
    }
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years}y ago`;
  } catch (e) {
    return "Just now";
  }
};

export default function FeedCard({ post, onLikeUpdate, onStoryCreated, showOptionsMenu = true }) {
  const router = useRouter();
  const { user, token } = useAuth();

  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikes] = useState(post.likes || 0);
  const [isSaved, setIsSaved] = useState(post.is_saved_by_user || false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Report modal state
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(post.is_following || false);
  const [followLoading, setFollowLoading] = useState(false);

  // Sync follow state with post data
  useEffect(() => {
    if (post.is_following != null) {
      setIsFollowing(post.is_following);
    }
  }, [post]);

  const mediaUrl = normalizeMediaUrl(post.media_url);
  const isVideo =
    post.media_type === "video" ||
    (mediaUrl && (
      mediaUrl.toLowerCase().endsWith(".mp4") ||
      mediaUrl.toLowerCase().endsWith(".mov") ||
      mediaUrl.toLowerCase().endsWith(".avi") ||
      mediaUrl.toLowerCase().endsWith(".webm") ||
      mediaUrl.toLowerCase().includes("/video") ||
      mediaUrl.toLowerCase().includes("video")
    ));

  // Normalize profile picture URL to ensure it works in feed
  const dpRaw = normalizeProfilePicture(
    post.user_profile_picture ||
    post.profile_picture ||
    post.user_profile_pic ||
    post.profile_pic ||
    post.userProfilePicture
  );

  const openPost = () => {
    // If it's a video, toggle play/pause instead of navigating
    if (isVideo) {
      setVideoPlaying(!videoPlaying);
    } else {
      router.push(`/post-details/${post.id}`);
    }
  };

  const handleOpenMap = () => {
    // If there's a map_link, open it
    if (post.map_link) {
      Linking.openURL(post.map_link);
    }
    // If there's only location_name, generate a Google Maps search link
    else if (post.location_name) {
      const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location_name)}`;
      Linking.openURL(searchUrl);
    }
  };

  const handleLike = async () => {
    const prev = isLiked;
    const prevLikes = likesCount;

    setIsLiked(!prev);
    setLikes(prev ? prevLikes - 1 : prevLikes + 1);

    try {
      if (prev) await unlikePost(post.id);
      else await likePost(post.id);
    } catch (e) {
      setIsLiked(prev);
      setLikes(prevLikes);
      console.log("❌ Like toggle failed:", e);
    }
  };

  const handleShare = () => {
    console.log("📤 Share button tapped, opening modal...");
    setShowShareModal(true);
  };

  const handleFollowToggle = async () => {
    if (!post.user_id || !token) {
      console.warn("Missing token or user_id");
      return;
    }

    try {
      setFollowLoading(true);
      const previousState = isFollowing;

      // Optimistic update
      setIsFollowing(!previousState);

      // Use correct backend endpoint: /api/users/{user_id}/follow or /api/users/{user_id}/unfollow
      const endpoint = previousState
        ? `/api/users/${post.user_id}/unfollow`
        : `/api/users/${post.user_id}/follow`;

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Follow API failed");
      }

      const data = await response.json();
      console.log(`✅ ${previousState ? 'Unfollowed' : 'Followed'} ${post.username}`, data);
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      // Revert state on failure
      setIsFollowing(previousState);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSave = async () => {
    const prev = isSaved;

    setIsSaved(!prev);

    try {
      if (prev) await unsavePost(post.id);
      else await savePost(post.id);
    } catch (e) {
      setIsSaved(prev);
      console.log("❌ Save toggle failed:", e);
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.userHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
        >
          <UserAvatar
            profilePicture={dpRaw}
            username={post.username}
            size={40}
            level={post.user_level}
            showLevelBadge
          />

          <View style={styles.userMeta}>
            <Text style={styles.username}>{post.username}</Text>
          </View>
        </TouchableOpacity>

        {user && String(post.user_id) !== String(user._id || user.id) && (
          <TouchableOpacity 
            style={[
              styles.followButton,
              isFollowing && styles.followingButton
            ]}
            onPress={handleFollowToggle}
            disabled={followLoading}
          >
            <Text style={[
              styles.followButtonText,
              isFollowing && styles.followingButtonText
            ]}>
              {followLoading ? "..." : (isFollowing ? "Following" : "Follow")}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Media */}
      <TouchableOpacity onPress={openPost} activeOpacity={0.9}>
        {isVideo ? (
          <View style={styles.videoContainer}>
            <Video
              source={{ uri: mediaUrl }}
              style={styles.video}
              resizeMode="cover"
              shouldPlay={videoPlaying}
              useNativeControls={true}
              isLooping={false}
              isMuted={false}
              onError={(error) => {
                console.error("❌ Video playback error in FeedCard:", error);
                console.error("❌ Video URL:", mediaUrl);

                // Try to recover by forcing a reload
                const timestamp = new Date().getTime();
                const refreshedUrl = mediaUrl.includes('?')
                  ? `${mediaUrl}&_t=${timestamp}`
                  : `${mediaUrl}?_t=${timestamp}`;

                // Set state to trigger re-render with refreshed URL
                setVideoError(true);
              }}
              onLoadStart={() => {
                console.log("📹 Video loading in FeedCard:", mediaUrl);
              }}
              onLoad={() => {
                console.log("✅ Video loaded in FeedCard");
              }}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                  setVideoPlaying(status.isPlaying);
                }
              }}
            />
            {!videoPlaying && (
              <View style={styles.playButtonOverlay}>
                <Ionicons name="play-circle" size={64} color="#FFF" />
              </View>
            )}
          </View>
        ) : (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={(error) => {
              console.error("❌ Image load error in FeedCard:", error);
              console.error("❌ Image URL:", mediaUrl);
            }}
          />
        )}
      </TouchableOpacity>

      {/* Post Details Section */}
      <View style={styles.postDetails}>
        {/* Rating */}
        <View style={styles.detailRow}>
          <Ionicons name="star" size={18} color="#FFD700" />
          <Text style={styles.detailText}>-{post.rating}/10</Text>
        </View>

        {/* Description */}
        {post.description && (
          <View style={styles.detailRow}>
            <Ionicons name="pricetag" size={18} color="#FFD700" />
            <Text style={styles.detailText}>-{post.description}</Text>
          </View>
        )}

        {/* Location */}
        {post.location_name && (
          <TouchableOpacity style={styles.detailRow} onPress={handleOpenMap}>
            <Ionicons name="location" size={18} color="#FFD700" />
            <Text style={styles.detailText}>-{post.location_name}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Row */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#FF4D4D" : "#666"}
          />
          <Text style={[styles.actionText, isLiked && styles.likedAction]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={() => router.push(`/comments/${post.id}`)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{post.comments || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handleSave}>
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={20}
            color={isSaved ? "#4dd0e1" : "#666"}
          />
        </TouchableOpacity>
      </View>


      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMenuModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenuModal(false)}
        >
          <View style={styles.menuModalContent}>
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenuModal(false);
                setShowReportModal(true);
                setReportDescription('');
              }}
            >
              <Ionicons name="flag-outline" size={20} color="#FF3B30" />
              <Text style={styles.menuOptionText}>Report Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuCancel}
              onPress={() => setShowMenuModal(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalContent}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Report Post</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReportModal(false);
                  setReportDescription('');
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.reportModalSubtitle}>
              Please describe why you're reporting this post
            </Text>

            <TextInput
              style={styles.reportDescriptionInput}
              placeholder="Enter description..."
              placeholderTextColor="#999"
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.reportSubmitButton, submittingReport && styles.reportSubmitButtonDisabled]}
              onPress={async () => {
                if (!reportDescription.trim()) {
                  Alert.alert('Error', 'Please provide a description for your report');
                  return;
                }

                setSubmittingReport(true);
                try {
                  await reportPost(post.id, reportDescription);
                  Alert.alert('Success', 'Post reported successfully');
                  setShowReportModal(false);
                  setReportDescription('');
                } catch (error) {
                  Alert.alert('Error', error.response?.data?.detail || error.message || 'Failed to submit report');
                } finally {
                  setSubmittingReport(false);
                }
              }}
              disabled={submittingReport}
            >
              {submittingReport ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.reportSubmitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Share Preview Modal */}
      <SharePreviewModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        post={post}
        onStoryCreated={onStoryCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    padding: 0,
  },

  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  userInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  userMeta: { marginLeft: 12 },

  username: {
    fontWeight: "600",
    fontSize: 16,
    color: "#333"
  },

  followButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  followButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  followingButton: {
    backgroundColor: "#4CAF50",
  },
  followingButtonText: {
    color: "#FFF",
  },

  // Instagram-style square 1:1 image
  image: { 
    width: "100%", 
    aspectRatio: 1, // Square 1:1 like Instagram
    borderRadius: 0 
  },
  videoContainer: {
    width: "100%",
    aspectRatio: 1, // Square 1:1 like Instagram
    borderRadius: 0,
    backgroundColor: "#000",
    position: "relative",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  playButtonOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },

  postDetails: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 8,
    flex: 1,
  },

  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  actionText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  likedAction: {
    color: "#FF4D4D",
    fontWeight: "600",
  },

  // Report Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuOptionText: {
    fontSize: 16,
    color: '#FF3B30',
    marginLeft: 12,
    fontWeight: '500',
  },
  menuCancel: {
    padding: 16,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  reportModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  reportModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  reportDescriptionInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    minHeight: 120,
    marginBottom: 20,
    backgroundColor: '#FAFAFA',
  },
  reportSubmitButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportSubmitButtonDisabled: {
    opacity: 0.6,
  },
  reportSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
