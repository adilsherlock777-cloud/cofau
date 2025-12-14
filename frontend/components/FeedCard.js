import React, { useState } from "react";
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
import { useAuth } from "../context/AuthContext";
import {
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  reportPost,
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
  showOptionsMenu = true,
}) {
  const router = useRouter();
  const { user } = useAuth();

  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikes] = useState(post.likes || 0);
  const [isSaved, setIsSaved] = useState(post.is_saved_by_user || false);

  const mediaUrl = normalizeMediaUrl(post.media_url);
  const isVideo =
    post.media_type === "video" || mediaUrl?.toLowerCase().endsWith(".mp4");

  const dpRaw = normalizeProfilePicture(post.user_profile_picture);

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
            size={48}
            level={post.user_level}
            showLevelBadge
          />
          <Text style={styles.username}>{post.username}</Text>
        </TouchableOpacity>
      </View>

      {/* MEDIA */}
      {!!mediaUrl &&
        (isVideo ? (
          <Video
            source={{ uri: mediaUrl }}
            style={styles.image}
            resizeMode="cover"
            shouldPlay
            isLooping
          />
        ) : (
          <Image source={{ uri: mediaUrl }} style={styles.image} />
        ))}

      {/* DETAILS */}
      <View style={styles.detailsContainer}>
        {/* RATING */}
        {post.rating != null && (
          <View style={styles.detailBox}>
            <Text style={styles.detailLabel}>RATING</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={18} color="#FFD700" />
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
              <Ionicons name="create-outline" size={18} color="#FFD700" />
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
                name="location-outline"
                size={18}
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
        <TouchableOpacity style={styles.actionButton}>
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
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    marginBottom: 20,
    elevation: 4,
  },

  userHeader: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
  },

  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  username: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },

  image: {
    width: "100%",
    aspectRatio: 1,
  },

  detailsContainer: {
    padding: 8,
  },

  detailBox: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    marginBottom: 6,
    letterSpacing: 0.5,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  ratingText: {
    fontSize: 18,
    color: "#333",
  },

  ratingNumber: {
    fontWeight: "700",
    fontSize: 18,
  },

  reviewRow: {
    flexDirection: "row",
    gap: 8,
  },

  reviewText: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },

  locationBox: {
    shadowColor: "#050505d0",
    shadowOffset: { width: 25, height: 35 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 5,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  locationText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
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
    color: "#666",
    fontWeight: "500",
  },

  likedCount: {
    color: "#E94A37",
  },
});
