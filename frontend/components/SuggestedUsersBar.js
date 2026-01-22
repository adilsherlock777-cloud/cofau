// components/SuggestedUsersBar.js

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { normalizeMediaUrl, normalizeProfilePicture, BACKEND_URL } from "../utils/imageUrlFix";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.38;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

export default function SuggestedUsersBar({ refreshTrigger }) {
  const router = useRouter();
  const { token } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [loadingFollow, setLoadingFollow] = useState(null);

  const fetchSuggestedUsers = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/users/suggestions?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data || []);
    } catch (error) {
      console.log("Error fetching suggested users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSuggestedUsers();
  }, [fetchSuggestedUsers, refreshTrigger]);

  const handleFollow = async (userId) => {
    if (!token || loadingFollow) return;
    
    setLoadingFollow(userId);
    
    try {
      if (followingIds.has(userId)) {
        // Unfollow
        await axios.delete(`${BACKEND_URL}/api/users/${userId}/follow`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFollowingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      } else {
        // Follow
        await axios.post(`${BACKEND_URL}/api/users/${userId}/follow`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFollowingIds(prev => new Set(prev).add(userId));
      }
    } catch (error) {
      console.log("Error following/unfollowing:", error?.response?.data || error);
    } finally {
      setLoadingFollow(null);
    }
  };

  const handleUserPress = (userId) => {
    router.push(`/user/${userId}`);
  };

  const handlePostPress = (postId) => {
    router.push(`/post/${postId}`);
  };

  const renderUserCard = ({ item }) => {
    const isFollowing = followingIds.has(item.id);
    const isLoadingThis = loadingFollow === item.id;
    const mediaUrl = normalizeMediaUrl(item.latest_post?.media_url);
    const profilePic = normalizeProfilePicture(item.profile_picture);

    return (
      <View style={styles.cardContainer}>
        {/* Background Image (Latest Post) */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePostPress(item.latest_post.id)}
          style={styles.imageContainer}
        >
          {mediaUrl ? (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.backgroundImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.backgroundImage, styles.placeholderBg]}>
              <Ionicons name="image-outline" size={40} color="#ccc" />
            </View>
          )}
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.7)"]}
            style={styles.gradientOverlay}
          />

          {/* Video indicator */}
          {item.latest_post?.media_type === "video" && (
            <View style={styles.videoIndicator}>
              <Ionicons name="play" size={12} color="#fff" />
            </View>
          )}

          {/* User Info Overlay */}
          <View style={styles.userInfoOverlay}>
            <TouchableOpacity
              onPress={() => handleUserPress(item.id)}
              style={styles.userRow}
            >
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {item.username?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </View>
              )}
              <View style={styles.usernameContainer}>
                <Text style={styles.username} numberOfLines={1}>
                  {item.username}
                </Text>
                <Text style={styles.postCount}>
                  {item.post_count} {item.post_count === 1 ? "post" : "posts"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Follow Button */}
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followingButton,
              ]}
              onPress={() => handleFollow(item.id)}
              disabled={isLoadingThis}
            >
              {isLoadingThis ? (
                <ActivityIndicator size="small" color={isFollowing ? "#333" : "#fff"} />
              ) : (
                <Text
                  style={[
                    styles.followButtonText,
                    isFollowing && styles.followingButtonText,
                  ]}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Don't render if no suggestions
  if (!loading && users.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Suggested for you</Text>
        <TouchableOpacity onPress={fetchSuggestedUsers}>
          <Ionicons name="refresh-outline" size={18} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#E94A37" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUserCard}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          snapToInterval={CARD_WIDTH + 12}
          decelerationRate="fast"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  loadingContainer: {
    height: CARD_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 12,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginHorizontal: 6,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
  },
  placeholderBg: {
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  videoIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  userInfoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    backgroundColor: "#E94A37",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  usernameContainer: {
    flex: 1,
    marginLeft: 8,
  },
  username: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  postCount: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
  },
  followButton: {
    backgroundColor: "#E94A37",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
  },
  followingButton: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  followButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  followingButtonText: {
    color: "#333",
  },
});