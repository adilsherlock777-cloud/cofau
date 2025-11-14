import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapButton from './MapButton';
import { LinearGradient } from 'expo-linear-gradient';
import { likePost, unlikePost } from '../utils/api';
import UserAvatar from './UserAvatar';
import { Video } from 'expo-av';

// Image or video URL normalizer
const fixUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${process.env.EXPO_PUBLIC_BACKEND_URL}${url.startsWith("/") ? url : "/" + url}`;
};

const formatTimestamp = (timestamp) => {
  const now = new Date();
  const postDate = new Date(timestamp);
  const diffInSeconds = Math.floor((now - postDate) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return postDate.toLocaleDateString();
};

export default function FeedCard({ post, onLikeUpdate }) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);

  const mediaUrl = fixUrl(post.media_url);
  const isVideo = mediaUrl?.endsWith(".mp4");

  const handleImagePress = () => {
    router.push(`/post-details/${post.id}`);
  };

  const handleLike = async () => {
    const prevLiked = isLiked;
    const prevLikes = likesCount;

    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevLikes - 1 : prevLikes + 1);

    try {
      if (prevLiked) await unlikePost(post.id);
      else await likePost(post.id);
    } catch (err) {
      console.log("❌ Like error:", err);
      setIsLiked(prevLiked);
      setLikesCount(prevLikes);
    }
  };

  return (
    <View style={styles.card}>
      {/* USER INFO */}
      <View style={styles.userHeader}>
        <TouchableOpacity
          style={styles.userInfoTouchable}
          onPress={() => router.push(`/profile?userId=${post.user_id}`)}
        >
          <UserAvatar
            profilePicture={fixUrl(post.user_profile_picture)}
            username={post.username}
            size={32}
            level={post.user_level}
            showLevelBadge
          />
          <View style={styles.userTextContainer}>
            <Text style={styles.username}>{post.username}</Text>
            {post.created_at && (
              <Text style={styles.timestamp}>{formatTimestamp(post.created_at)}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* MEDIA DISPLAY */}
      <TouchableOpacity onPress={handleImagePress}>
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
            style={styles.postImage}
            resizeMode="cover"
            onError={(e) => console.log("❌ Image error:", mediaUrl, e.nativeEvent)}
          />
        )}
      </TouchableOpacity>

      {/* ACTION ROW */}
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={handleLike} style={styles.actionItem}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={24}
            color={isLiked ? "#FF6B6B" : "#999"}
          />
          <Text style={[styles.actionText, isLiked && styles.likedText]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => router.push(`/comments/${post.id}`)}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#999" />
          <Text style={styles.actionText}>{post.comments || 0}</Text>
        </TouchableOpacity>
      </View>

      {/* DESCRIPTION */}
      <View style={styles.descriptionSection}>
        <Text style={styles.descriptionText}>
          <Text style={styles.boldUsername}>{post.username}</Text> {post.description}
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
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 12,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  userInfoTouchable: { flexDirection: "row", alignItems: "center", flex: 1 },
  userTextContainer: { marginLeft: 8 },
  username: { fontWeight: "bold", fontSize: 15, color: "#333" },
  timestamp: { fontSize: 12, color: "#999" },

  /* Media */
  postImage: { width: "100%", height: 260, borderRadius: 12 },
  video: { width: "100%", height: 260, borderRadius: 12, backgroundColor: "#000" },

  /* Action Row */
  actionRow: { flexDirection: "row", paddingVertical: 12, gap: 20 },
  actionItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontSize: 14, color: "#666" },
  likedText: { color: "#FF6B6B" },

  descriptionSection: { marginTop: 6 },
  descriptionText: { fontSize: 14, color: "#444" },
  boldUsername: { fontWeight: "bold" },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
});
