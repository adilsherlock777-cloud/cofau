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
const CARD_WIDTH = SCREEN_WIDTH - 32;

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
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
    } finally {
      setLoadingFollow(null);
    }
  };

  const getLevelBadgeColor = (level) => {
    if (level >= 10) return ["#FFD700", "#FFA500"];
    if (level >= 7) return ["#C0C0C0", "#A0A0A0"];
    if (level >= 4) return ["#CD7F32", "#A0522D"];
    return ["#1B7C82", "#15656A"];
  };

  const formatCount = (count) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
    if (count >= 1000) return (count / 1000).toFixed(1) + "K";
    return String(count || 0);
  };

  const renderUserCard = ({ item }) => {
    const isLoadingThis = loadingFollow === item.id;
    const profilePic = normalizeProfilePicture(item.profile_picture);
    const userLevel = item.level || 1;
    const recentPosts = (item.recent_posts || []).slice(0, 4);
    const badgeColors = getLevelBadgeColor(userLevel);

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/profile?userId=${item.id}`)}
          style={styles.cardInner}
        >
          {/* Left Side - Avatar, Stats, Follow */}
          <View style={styles.leftSection}>
            {/* Avatar with Level Badge */}
            <View style={styles.avatarWrapper}>
              <LinearGradient
                colors={badgeColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={styles.avatarInner}>
                  {profilePic ? (
                    <Image source={{ uri: profilePic }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>
                        {item.username?.charAt(0)?.toUpperCase() || "?"}
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
              <LinearGradient
                colors={badgeColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.levelBadge}
              >
                <Text style={styles.levelBadgeText}>{userLevel}</Text>
              </LinearGradient>
            </View>

            {/* Username */}
            <Text style={styles.username} numberOfLines={1}>
              {item.username}
            </Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{formatCount(item.post_count)}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{formatCount(item.followers_count)}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
            </View>

            {/* Follow Button */}
            <TouchableOpacity
              onPress={() => handleFollow(item.id)}
              disabled={isLoadingThis}
              style={styles.followButtonWrap}
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

          {/* Right Side - Post Grid */}
          <View style={styles.rightSection}>
            <View style={styles.postGrid}>
              {[0, 1, 2, 3].map((idx) => {
                const post = recentPosts[idx];
                const postMedia = post ? normalizeMediaUrl(post.media_url) : null;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.gridItem}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (post) router.push(`/profile?userId=${item.id}`);
                    }}
                  >
                    {postMedia ? (
                      <Image
                        source={{ uri: postMedia }}
                        style={styles.gridImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.gridImage, styles.gridPlaceholder]}>
                        <Ionicons name="image-outline" size={20} color="#ccc" />
                      </View>
                    )}
                    {post?.media_type === "video" && (
                      <View style={styles.videoIcon}>
                        <Ionicons name="play" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
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
          snapToInterval={CARD_WIDTH + 16}
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
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 12,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginHorizontal: 8,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  cardInner: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 16,
    overflow: "hidden",
  },
  // Left Section
  leftSection: {
    width: "38%",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: "#f0f0f0",
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 8,
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2.5,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInner: {
    width: 59,
    height: 59,
    borderRadius: 30,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: "#E94A37",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  levelBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  levelBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  username: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
    marginBottom: 8,
    maxWidth: "100%",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: "800",
    color: "#222",
  },
  statLabel: {
    fontSize: 10,
    color: "#888",
    fontWeight: "500",
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#e0e0e0",
  },
  followButtonWrap: {
    width: "100%",
  },
  followButton: {
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
  },
  followButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  // Right Section
  rightSection: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: "center",
  },
  postGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  gridItem: {
    width: "48.5%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  videoIcon: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
