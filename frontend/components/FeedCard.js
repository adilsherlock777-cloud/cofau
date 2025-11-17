import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Video } from "expo-av";
import moment from "moment";

import UserAvatar from "./UserAvatar";
import { likePost, unlikePost } from "../utils/api";

const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";

/* ----------------------------------------------------------
   ✅ UNIVERSAL URL NORMALIZER
-----------------------------------------------------------*/
const normalizeUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  let cleaned = url.trim();
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1"); // remove duplicate slashes

  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;

  return `${BACKEND}${cleaned}`;
};

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

export default function FeedCard({ post, onLikeUpdate }) {
  const router = useRouter();

  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikes] = useState(post.likes || 0);

  const mediaUrl = normalizeUrl(post.media_url);
  const isVideo =
  post.media_type === "video" ||
  mediaUrl.includes(".mp4") ||
  mediaUrl.includes(".mov") ||
  mediaUrl.includes("video");

  const dpRaw =
    post.user_profile_picture ||
    post.profile_picture ||
    post.user_profile_pic ||
    post.profile_pic ||
    post.userProfilePicture;

  const openPost = () => router.push(`/post-details/${post.id}`);

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
              {moment(post.created_at).fromNow()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Media */}
      <TouchableOpacity onPress={openPost}>
        {isVideo ? (
          <Video
            source={{ uri: mediaUrl }}
            style={styles.video}
            resizeMode="cover"
            useNativeControls
            isLooping
          />
        ) : (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.image}
            resizeMode="cover"
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
              {extractLocationName(post.map_link)}
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
  video: {
    width: "100%",
    height: 260,
    borderRadius: 12,
    backgroundColor: "#000",
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
