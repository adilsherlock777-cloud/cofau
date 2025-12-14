import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import axios from "axios";

import { useAuth } from "../context/AuthContext";
import FeedCard from "../components/FeedCard";
import UserAvatar from "../components/UserAvatar";
import StoriesBar from "../components/StoriesBar";
import { fetchUnreadCount } from "../utils/notifications";
import {
  normalizeMediaUrl,
  normalizeProfilePicture,
  BACKEND_URL,
} from "../utils/imageUrlFix";

const BACKEND = BACKEND_URL;

/* -------------------------
   Normalize DP
------------------------- */
const getPostDP = (post: any) =>
  normalizeProfilePicture(
    post.user_profile_picture ||
      post.profile_picture ||
      post.profile_picture_url ||
      post.profile_pic ||
      post.user_profile_pic ||
      post.userProfilePicture ||
      post.profilePicture
  );

export default function FeedScreen() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuth() as any;

  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchFeed();
    loadUnreadCount();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUnreadCount();
      refreshUser();
      fetchFeed(true);
    }, [token])
  );

  const loadUnreadCount = async () => {
    if (!token) return;
    try {
      const count = await fetchUnreadCount(token);
      setUnreadCount(count);
    } catch {}
  };

  const fetchFeed = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const ts = forceRefresh ? `?_t=${Date.now()}` : "";
      const res = await axios.get(`${BACKEND}/api/feed${ts}`);

      const mapped = res.data.map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        username: post.username,
        user_profile_picture: getPostDP(post),
        description: post.review_text || post.description,
        rating: post.rating,
        media_url: normalizeMediaUrl(post.image_url || post.media_url),
        media_type: post.media_type,
        created_at: post.created_at,
        user_level: post.user_level || post.level || post.userLevel,
        // Location fields
        location_name: post.location_name || post.location || post.place_name,
        location_address: post.location_address || post.address,
        map_link: post.map_link || post.google_maps_link,
        // Engagement fields
        likes: post.likes || post.likes_count || 0,
        comments: post.comments || post.comments_count || 0,
        is_liked: post.is_liked || false,
        is_saved_by_user: post.is_saved_by_user || post.is_saved || false,
        is_following: post.is_following || false,
      }));

      mapped.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setFeedPosts(mapped);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ================= HEADER WITH GRADIENT ================= */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#E94A37", "#F2CF68", "#1B7C82"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          {/* Top row with icons */}
          <View style={styles.headerRow}>
            {/* Left Message Icon */}
            <TouchableOpacity
              style={styles.leftIcon}
              onPress={() => router.push("/chat")}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.cofauTitle}>Cofau</Text>

            <View style={styles.headerIcons}>
              <TouchableOpacity onPress={() => router.push("/notifications")}>
                <Ionicons name="notifications-outline" size={24} color="#fff" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* ===== LEVEL CARD WITH OVERLAPPING DP (IMAGE 2 STYLE) ===== */}
        {user && (
          <View style={styles.levelCardWrapper}>
            {/* Level card - white background */}
            <View style={styles.levelCard}>
              {/* Profile picture - positioned to overlap on the left */}
              <View style={styles.dpContainer}>
                <UserAvatar
                  profilePicture={user.profile_picture}
                  username={user.username}
                  size={90}
                  showLevelBadge={false}
                />
                <TouchableOpacity
                  style={styles.dpAddButton}
                  onPress={() => router.push("/add-post")}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.levelContent}>
                <Text style={styles.levelLabel}>Level {user.level}</Text>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <LinearGradient
                      colors={["#E94A37", "#F2CF68", "#1B7C82"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(
                            ((user.currentPoints || 0) /
                              (user.requiredPoints || 1250)) *
                              100,
                            100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {user.currentPoints || 0}/{user.requiredPoints || 1250}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 90 }} // ✅ space for bottom nav
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFeed(true)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ================= STORIES ================= */}
        <StoriesBar />

        {/* ================= FEED ================= */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4dd0e1" />
            <Text style={styles.loadingText}>Loading feed...</Text>
          </View>
        )}

        {!loading &&
          feedPosts.map((post) => (
            <View key={post.id} style={styles.postContainer}>
              <FeedCard post={post} onLikeUpdate={fetchFeed} />
            </View>
          ))}
      </ScrollView>

      {/* ================= BOTTOM TABS (ONLY ADDITION) ================= */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push("/feed")}>
          <Ionicons name="home" size={28} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/explore")}>
          <Ionicons name="compass-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/leaderboard")}>
          <Ionicons name="trophy-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Leaderboard</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/happening")}>
          <Ionicons name="restaurant-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Restaurant</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/profile")}>
          <Ionicons name="person-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  headerContainer: {
    position: "relative",
    marginBottom: 12,
  },

  gradientHeader: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  leftIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  cofauTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Lobster",
    fontSize: 36,
    color: "#fff",
    letterSpacing: 1,
    zIndex: -1,
  },

  headerIcons: {
    flexDirection: "row",
    gap: 16,
  },

  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  /* ===== LEVEL CARD WITH OVERLAPPING DP (IMAGE 2) ===== */
  levelCardWrapper: {
    marginHorizontal: 20,
    marginTop: -35,
  },

  levelCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingVertical: 15,
    paddingLeft: 102,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    position: "relative",
  },

  dpContainer: {
    position: "absolute",
    left: 5.5,
    top: "50%",
    transform: [{ translateY: -50 }],
    zIndex: 8,
  },

  dpAddButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#4dd0e1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },

  levelContent: {
    flex: 1,
  },

  levelLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },

  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#E8E8E8",
    borderRadius: 4,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 4,
  },

  progressText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },

  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 12,
    color: "#666",
  },

  postContainer: {
    marginBottom: 20,
  },

  /* ✅ ONLY ADDED: BOTTOM NAV */
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },

  navLabel: {
    fontSize: 10,
    color: "#000",
    marginTop: 4,
    textAlign: "center",
  },
});
