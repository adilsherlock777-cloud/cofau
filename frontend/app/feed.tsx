import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import axios from "axios";

import { useAuth } from "../context/AuthContext";
import RatingBar from "../components/RatingBar";
import FeedCard from "../components/FeedCard";
import UserAvatar from "../components/UserAvatar";
import StoriesBar from "../components/StoriesBar";
import { fetchUnreadCount } from "../utils/notifications";
import { normalizeMediaUrl, normalizeProfilePicture, BACKEND_URL } from "../utils/imageUrlFix";

// BASE BACKEND URL
const BACKEND = BACKEND_URL;

/* -----------------------------------------------------
   ✅ FIX DP FOR FEED POSTS (all possible fields)
----------------------------------------------------- */
const getPostDP = (post: any) => {
  return normalizeProfilePicture(
    post.user_profile_picture ||
      post.profile_picture ||
      post.profile_picture_url ||
      post.profile_pic ||
      post.user_profile_pic ||
      post.userProfilePicture ||
      post.profilePicture
  );
};

export default function FeedScreen() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuth();

  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchFeed();
    loadUnreadCount();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUnreadCount();
      // Refresh user data when screen comes into focus to show updated points
      refreshUser();
      // Refresh feed when returning to screen (e.g., from comments) to update counts
      fetchFeed();
    }, [token])
  );

  const loadUnreadCount = async () => {
    if (!token) return;

    try {
      const count = await fetchUnreadCount(token);
      setUnreadCount(count);
    } catch (err) {
      console.log("❌ Error loading unread count:", err);
    }
  };

  /* -----------------------------------------------------
      ✅ FETCH FEED & NORMALIZE DP / MEDIA
  ----------------------------------------------------- */
  const fetchFeed = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await axios.get(`${BACKEND}/api/feed`);
      const data = response.data;

      const transformed = data.map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        username: post.username,

        // DP (already normalized)
        user_profile_picture: getPostDP(post),

        user_badge: post.user_badge,
        user_level: post.user_level,
        user_title: post.user_title,

        description: post.review_text,
        rating: post.rating,
        ratingLabel: getRatingLabel(post.rating),

        location: extractLocation(post.map_link),
        mapsUrl: post.map_link,
        map_link: post.map_link,
        location_name: post.location_name,

        likes: post.likes_count,
        comments: post.comments_count,
        is_liked: post.is_liked_by_user,

        // ✅ media URL normalized safely
        media_url: normalizeMediaUrl(post.image_url || post.media_url),
        media_type: post.media_type,

        // ✅ keep raw timestamp; FeedCard formats as "2h ago"
        created_at: post.created_at,
      }));

      setFeedPosts(transformed);
    } catch (err: any) {
      console.log("❌ Feed fetch error:", err?.response?.data || err.message);
      setError("Failed to load feed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const getRatingLabel = (rating: number) => {
    if (rating >= 9) return "Excellent Food";
    if (rating >= 7) return "Very Good Food";
    if (rating >= 5) return "Good Food";
    if (rating >= 3) return "Average Food";
    return "Below Average";
  };

  const extractLocation = (mapLink: string | null) => {
    if (!mapLink) return "No location";

    try {
      const u = new URL(mapLink);
      const q = u.searchParams.get("q");
      if (q) return q;

      const match = mapLink.match(/q=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "Location";
    } catch {
      return "Location";
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cofau</Text>

        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push("/notifications")}
        >
          <Ionicons name="notifications-outline" size={26} color="#fff" />

          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >

        {console.log("userss", user)}
        {/* USER HEADER */}
        {user && (
          <View style={styles.userCard}>
            <View style={styles.userRow}>
              <UserAvatar
                profilePicture={user.profile_picture}
                username={user.full_name || user.username}
                size={50}
                level={user.level}
                showLevelBadge
                style={{}}
              />

              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.full_name}</Text>
                <Text style={styles.levelText}>Level {user.level}</Text>

                <RatingBar
                  current={user.currentPoints || 0}
                  total={user.requiredPoints || 1250}
                  label=""
                />
              </View>
            </View>
          </View>
        )}

        {/* STORIES */}
        <StoriesBar />

        {/* LOADING */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4dd0e1" />
            <Text style={styles.loadingText}>Loading feed...</Text>
          </View>
        )}

        {/* ERROR */}
        {error && !loading && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>

            <TouchableOpacity style={styles.retryBtn} onPress={fetchFeed}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FEED POSTS */}
        {!loading &&
          !error &&
          feedPosts.map((post) => (
            <FeedCard 
              key={post.id} 
              post={post} 
              onLikeUpdate={fetchFeed}
            />
          ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* NAVBAR */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push("/feed")}>
          <Ionicons name="home" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/explore")}>
          <Ionicons name="compass-outline" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/add-post")}>
          <Ionicons name="add-circle-outline" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/happening")}>
          <Ionicons name="flame-outline" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/profile")}>
          <Ionicons name="person-outline" size={28} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

  header: {
    backgroundColor: "#3B5998",
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTitle: { color: "#fff", fontWeight: "bold", fontSize: 20 },

  notificationButton: { padding: 8, position: "relative" },

  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },

  scrollView: { flex: 1 },

  userCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
  },

  userRow: { flexDirection: "row", alignItems: "center" },

  userInfo: { marginLeft: 16, flex: 1 },

  userName: { fontSize: 18, fontWeight: "bold", color: "#333" },

  levelText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },

  loadingContainer: { padding: 40, alignItems: "center" },
  loadingText: { marginTop: 12, color: "#666" },

  errorBox: { padding: 40, alignItems: "center" },
  errorText: { marginTop: 12, color: "#FF6B6B", fontSize: 16 },

  retryBtn: {
    marginTop: 16,
    backgroundColor: "#4dd0e1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },

  retryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
});
