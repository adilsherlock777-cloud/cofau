import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Video } from "expo-av";

import UserAvatar from "./UserAvatar";
import { likePost, unlikePost } from "../utils/api";
import { normalizeMediaUrl, normalizeProfilePicture } from "../utils/imageUrlFix";

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

export default function FeedCard({ post, onLikeUpdate }) {
  const router = useRouter();

  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikes] = useState(post.likes || 0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);

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
    if (!post.map_link) return;
    Linking.openURL(post.map_link);
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
            size={32}
            level={post.user_level}
            showLevelBadge
          />

          <View style={styles.userMeta}>
            <Text style={styles.username}>{post.username}</Text>

            <Text style={styles.timestamp}>
              {getTimeAgo(post.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
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

      {/* Action Row */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={24}
            color={isLiked ? "#FF6B6B" : "#999"}
          />
          <Text style={[styles.actionText, isLiked && styles.likedAction]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={() => router.push(`/comments/${post.id}`)}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#999" />
          <Text style={styles.actionText}>{post.comments || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      <View style={styles.desc}>
        <Text style={styles.descText}>
          <Text style={styles.descBold}>{post.username}</Text> {post.description}
        </Text>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color="#FFD700" />
          <Text style={styles.ratingText}>{post.rating}/10</Text>
        </View>

        {/* ------------------------------------------
            📍 LOCATION BUTTON (FREE GOOGLE MAPS LINK)
        ------------------------------------------- */}
        {post.map_link && (
          <TouchableOpacity style={styles.locationButton} onPress={handleOpenMap}>
            <Ionicons name="location" size={18} color="#4ECDC4" />
            <Text style={styles.locationText}>
              {post.location_name || extractLocationName(post.map_link)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#4ECDC4" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 12,
  },

  userHeader: { flexDirection: "row", marginBottom: 12 },
  userInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  userMeta: { marginLeft: 8 },

  username: { fontWeight: "bold", fontSize: 15, color: "#333" },
  timestamp: { fontSize: 12, color: "#888" },

  image: { width: "100%", height: 260, borderRadius: 12 },
  videoContainer: {
    width: "100%",
    height: 260,
    borderRadius: 12,
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

  actions: { flexDirection: "row", paddingVertical: 12, gap: 20 },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontSize: 14, color: "#666" },
  likedAction: { color: "#FF6B6B" },

  desc: { marginTop: 6 },
  descText: { fontSize: 14, color: "#444" },
  descBold: { fontWeight: "600" },

  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  ratingText: { marginLeft: 4, fontWeight: "600", color: "#333" },

  /* LOCATION BUTTON */
  locationButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3FFFD",
    padding: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "#CFFAF0",
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
});
