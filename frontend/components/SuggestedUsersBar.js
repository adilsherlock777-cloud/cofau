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
      await axios.post(`${BACKEND_URL}/api/users/${userId}/follow`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Remove the user card immediately after following
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
    } finally {
      setLoadingFollow(null);
    }
  };

  // Navigate to user profile
const handleUserPress = (userId) => {
  router.push(`/profile?userId=${userId}`);
};

// Navigate to user profile when tapping post image
const handlePostPress = (userId) => {
  router.push(`/profile?userId=${userId}`);
};
  // Get badge color based on level
  const getLevelBadgeColor = (level) => {
    if (level >= 10) return "#FFD700"; // Gold
    if (level >= 7) return "#C0C0C0";  // Silver
    if (level >= 4) return "#CD7F32";  // Bronze
    return "#1B7C82";                   // Default teal
  };

  const renderUserCard = ({ item }) => {
    const isLoadingThis = loadingFollow === item.id;
    const mediaUrl = normalizeMediaUrl(item.latest_post?.media_url);
    const profilePic = normalizeProfilePicture(item.profile_picture);
    const userLevel = item.level || 1;

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/profile?userId=${item.id}`)}
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
          
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            style={styles.gradientOverlay}
          />

          {item.latest_post?.media_type === "video" && (
            <View style={styles.videoIndicator}>
              <Ionicons name="play" size={12} color="#fff" />
            </View>
          )}

          <View style={styles.userInfoOverlay}>
            <TouchableOpacity
              onPress={() => router.push(`/profile?userId=${item.id}`)} 
              style={styles.userRow}
            >
              {/* Avatar with Level Badge */}
              <View style={styles.avatarContainer}>
                {profilePic ? (
                  <Image source={{ uri: profilePic }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>
                      {item.username?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                
                {/* Level Badge */}
                <View 
                  style={[
                    styles.levelBadge, 
                    { backgroundColor: getLevelBadgeColor(userLevel) }
                  ]}
                >
                  <Text style={styles.levelBadgeText}>{userLevel}</Text>
                </View>
              </View>

              <View style={styles.usernameContainer}>
                <Text style={styles.username} numberOfLines={1}>
                  {item.username}
                </Text>
                <Text style={styles.postCount}>
                  {item.post_count} {item.post_count === 1 ? "post" : "posts"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleFollow(item.id)}
              disabled={isLoadingThis}
            >
              <LinearGradient
                colors={["#FF2E2E", "#FF7A18"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.followButton}
              >
                {isLoadingThis ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.followButtonText}>Follow</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (!loading && users.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Suggested for you</Text>
        <TouchableOpacity onPress={fetchSuggestedUsers}>
          <Ionicons name="refresh-outline" size={18} color="#666" />
        </TouchableOpacity>
      </View>

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
    marginVertical: 8,
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
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
    height: "65%",
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
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  levelBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  levelBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
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
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
  },
  followButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});