import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Video } from 'expo-av';
import UserAvatar from './UserAvatar';
import MapButton from './MapButton';
import { likePost, unlikePost } from '../utils/api';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com/api";

/** 
 * Normalizes any backend URL
 * - Prevents double slashes
 * - Prevents api/api duplication
 * - Supports absolute URLs
 */
const fixUrl = (url) => {
  if (!url) return null;

  // Already absolute (http/https)
  if (url.startsWith("http")) return url;

  // Remove any accidental double slashes
  const cleaned = url.replace(/\/+/g, "/");

  // Make sure we don't create /api/api
  if (cleaned.startsWith("/api")) {
    return `${BASE}${cleaned.substring(4)}`; // remove "/api" because BASE already has /api
  }

  // If starts with "/", just append to BASE
  if (cleaned.startsWith("/")) {
    return `${BASE}${cleaned}`;
  }

  // Otherwise just join normally
  return `${BASE}/${cleaned}`;
};

const formatTime = (timestamp) => {
  const now = new Date();
  const d = new Date(timestamp);
  const diff = (now - d) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
};

export default function FeedCard({ post, onLikeUpdate }) {
  const router = useRouter();

  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikes] = useState(post.likes || 0);

  const mediaUrl = fixUrl(post.media_url);
  const isVideo = mediaUrl?.toLowerCase().endsWith(".mp4");

  const dpUrl = fixUrl(post.user_profile_picture);

  const openPost = () => {
    router.push(`/post-details/${post.id}`);
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
      // revert on error
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
            profilePicture={dpUrl}
            username={post.username}
            size={32}
            level={post.user_level}
            showLevelBadge
          />

          <View style={styles.userMeta}>
            <Text style={styles.username}>{post.username}</Text>
            <Text style={styles.timestamp}>{formatTime(post.created_at)}</Text>
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
      </View>

      <MapButton restaurantName={post.location} mapsUrl={post.mapsUrl} />
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
  video: { width: "100%", height: 260, borderRadius: 12, backgroundColor: "#000" },

  actions: { flexDirection: "row", paddingVertical: 12, gap: 20 },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontSize: 14, color: "#666" },
  likedAction: { color: "#FF6B6B" },

  desc: { marginTop: 6 },
  descText: { fontSize: 14, color: "#444" },
  descBold: { fontWeight: "600" },

  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  ratingText: { marginLeft: 4, fontWeight: "600", color: "#333" },
});
