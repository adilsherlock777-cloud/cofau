import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Image } from "expo-image";
import { likePost, unlikePost, reportPost } from "../utils/api";

// =======================
//  CONFIG
// =======================
const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLUMNS = 3;
const SPACING = 2;
const TILE_SIZE = (SCREEN_WIDTH - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

// ------------------------------------------------------------
// 🔥 UNIVERSAL URL FIXER (same as FeedCard & Stories)
// ------------------------------------------------------------
const fixUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  let cleaned = url.trim();
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;

  return `${API_BASE_URL}${cleaned}`;
};

// ------------------------------------------------------------
// 🔥 UNIVERSAL VIDEO CHECKER
// Backend may store MOV, MP4, MKV, no extension, etc.
// ------------------------------------------------------------
const isVideoFile = (url: string, media_type: string) => {
  if (media_type === "video") return true;

  if (!url) return false;
  const lower = url.toLowerCase();

  return (
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes(".mkv") ||
    lower.includes(".webm")
  );
};

// =======================
//  MAIN COMPONENT
// =======================
export default function ExploreScreen() {
  const router = useRouter();
  const auth = useAuth() as { user: any; token: string | null };
  const { user, token } = auth;

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user && token) {
        console.log('🔄 Explore screen focused - refreshing posts');
        fetchPosts(true);
      }
    }, [user, token])
  );

  // ================================
  // 🔥 Fetch Explore Posts
  // ================================
  const fetchPosts = async (refresh = false) => {
    try {
      if (refresh) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const skip = refresh ? 0 : (page - 1) * 30;

      // No limit parameter - fetch ALL posts
      const res = await axios.get(`${API_URL}/feed?skip=${skip}`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      const newPosts = res.data.map((post: any) => {
        const rawUrl = post.media_url || post.image_url;

        const fullUrl = fixUrl(rawUrl);
        const thumb = fixUrl(post.thumbnail_url);

        return {
          ...post,
          full_image_url: fullUrl,
          full_thumbnail_url: thumb,
          is_liked: post.is_liked_by_user || false,
          _isVideo: isVideoFile(fullUrl || '', post.media_type),
        };
      });

      // ✅ Sort by created_at descending (newest first)
      const sortedNewPosts = newPosts.sort((a: any, b: any) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Descending order (newest first)
      });

      if (refresh) {
        setPosts(sortedNewPosts);
      } else {
        // When appending, combine and sort all posts
        setPosts((p) => {
          const combined = [...p, ...sortedNewPosts];
          return combined.sort((a: any, b: any) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA; // Descending order (newest first)
          });
        });
      }

      setPage((prev) => prev + 1);
    } catch (err) {
      console.error("❌ Explore fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ==================================
  // 🔍 Search Logic with Backend API
  // ==================================
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    try {
      setSearching(true);
      const res = await axios.get(`${API_URL}/search/posts`, {
        params: { q: query.trim(), limit: 100 },
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      const searchPosts = res.data.map((post: any) => {
        const rawUrl = post.media_url || post.image_url;
        const fullUrl = fixUrl(rawUrl);
        const thumb = fixUrl(post.thumbnail_url);

        return {
          ...post,
          full_image_url: fullUrl,
          full_thumbnail_url: thumb,
          is_liked: post.is_liked_by_user || false,
          _isVideo: isVideoFile(fullUrl || '', post.media_type),
        };
      });

      // ✅ Sort search results by created_at descending (newest first)
      const sortedSearchPosts = searchPosts.sort((a: any, b: any) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Descending order (newest first)
      });

      setSearchResults(sortedSearchPosts);
    } catch (err) {
      console.error("❌ Search error:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 500); // 500ms debounce
    } else {
      setSearchResults([]);
      setSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, token]);

  // Determine which posts to display
  const displayPosts = searchQuery.trim() ? searchResults : posts;

  // ==================================
  // ❤️ Like/Unlike Handler
  // ==================================
  const handleLike = async (id: string, liked: boolean) => {
    try {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
              ...p,
              is_liked: !liked,
              likes_count: p.likes_count + (liked ? -1 : 1),
            }
            : p
        )
      );

      liked ? await unlikePost(id) : await likePost(id);
    } catch (err) {
      console.log("❌ Like error:", err);
    }
  };

  // ==================================
  // 🔳 Render Grid Tile
  // ==================================
  const renderGridItem = ({ item }: any) => {
    const displayImg = item._isVideo
      ? item.full_thumbnail_url || item.full_image_url
      : item.full_image_url;

    return (
      <TouchableOpacity
        style={styles.tile}
        activeOpacity={0.85}
        onPress={() => router.push(`/post-details/${item.id}`)}
      >
        <Image
          source={displayImg}
          style={styles.gridImage}
          placeholder={{ blurhash: BLUR_HASH }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={300}
        />

        {item._isVideo && (
          <View style={styles.playIcon}>
            <Ionicons name="play-circle" size={28} color="#fff" />
          </View>
        )}

        <TouchableOpacity
          style={styles.likeBtn}
          onPress={(e) => {
            e.stopPropagation();
            handleLike(item.id, item.is_liked);
          }}
        >
          <Ionicons
            name={item.is_liked ? "heart" : "heart-outline"}
            size={20}
            color={item.is_liked ? "#FF4D4D" : "#ffffff"}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ==================================
  // ⏳ Loading States
  // ==================================
  if (!user || !token)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text>Authenticating…</Text>
      </View>
    );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text>Loading explore…</Text>
      </View>
    );

  // ==================================
  // MAIN UI
  // ==================================
  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search posts, locations, users…"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searching ? (
          <ActivityIndicator size="small" color="#777" />
        ) : (
          <Ionicons name="search" size={20} color="#777" />
        )}
      </View>

      {/* Search Results Info */}
      {searchQuery.trim() && (
        <View style={styles.searchInfo}>
          <Text style={styles.searchInfoText}>
            {searching
              ? "Searching…"
              : searchResults.length > 0
                ? `Found ${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
                : "No results found"}
          </Text>
        </View>
      )}

      {/* Grid */}
      <FlatList
        data={displayPosts}
        renderItem={renderGridItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        columnWrapperStyle={{
          gap: SPACING,
          paddingHorizontal: SPACING,
        }}
        onEndReached={() => {
          if (!searchQuery.trim()) {
            fetchPosts(false);
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && !searching && searchQuery.trim() && searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No posts found</Text>
              <Text style={styles.emptySubtext}>
                Try searching for different keywords
              </Text>
            </View>
          ) : null
        }
      />

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push("/feed")}>
          <Ionicons name="home-outline" size={28} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/explore")}>
          <Ionicons name="compass" size={28} color="#000" />
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

// =======================
//  STYLES
// =======================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchBox: {
    margin: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f2f2f2",
    flexDirection: "row",
    alignItems: "center",
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    marginRight: 10,
  },

  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#eaeaea",
    position: "relative",
    marginBottom: SPACING,
  },

  gridImage: {
    width: "100%",
    height: "100%",
  },

  playIcon: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 4,
    borderRadius: 20,
  },

  likeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 4,
    borderRadius: 20,
  },

  searchInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },

  searchInfoText: {
    fontSize: 14,
    color: "#666",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },

  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
  },

  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#999",
  },
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
  },
});
