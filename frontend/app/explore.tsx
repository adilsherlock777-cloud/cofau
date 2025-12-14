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
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
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

// ------------------------------------------------------------
// 🔥 GRADIENT HEART COMPONENT (Cofau Theme)
// ------------------------------------------------------------
const GradientHeart = ({ size = 18 }) => {
  return (
    <MaskedView
      maskElement={
        <View style={{ backgroundColor: 'transparent' }}>
          <Ionicons name="heart" size={size} color="#000" />
        </View>
      }
    >
      <LinearGradient
        colors={["#E94A37", "#F2CF68", "#1B7C82"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size }}
      />
    </MaskedView>
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
  // 🔍 Search Logic - Navigate to Search Results Page
  // ==================================
  const performSearch = () => {
    if (searchQuery.trim()) {
      // Navigate to search results page with the query
      router.push({
        pathname: "/search-results",
        params: { query: searchQuery.trim() },
      });
    }
  };

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

        {/* Like Button with Gradient Heart */}
        <TouchableOpacity
          style={styles.likeBtn}
          onPress={(e) => {
            e.stopPropagation();
            handleLike(item.id, item.is_liked);
          }}
        >
          {item.is_liked ? (
            <GradientHeart size={18} />
          ) : (
            <Ionicons name="heart-outline" size={18} color="#ffffff" />
          )}
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
      {/* Header Container - Gradient + Overlapping Search */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#E94A37", "#F2CF68", "#1B7C82"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientHeader}
        >
          <Text style={styles.headerTitle}>Cofau</Text>
        </LinearGradient>
        
        {/* Search bar - Overlapping gradient edge */}
        <View style={styles.searchBoxWrapper}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={performSearch}
            />
          </View>
        </View>
      </View>

      {/* Grid - No gap from search bar */}
      <FlatList
        data={posts}
        renderItem={renderGridItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        columnWrapperStyle={{
          gap: SPACING,
          paddingHorizontal: SPACING,
        }}
        onEndReached={() => {
          fetchPosts(false);
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
      />

      {/* Bottom Navigation - With Labels */}
      <View style={styles.navBar}>
        {/* Home */}
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/feed")}>
          <Ionicons name="home-outline" size={24} color="#333" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        
        {/* Explore */}
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/explore")}>
          <Ionicons name="compass" size={24} color="#333" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>
        
        {/* Center - Leaderboard (Trophy) */}
        <TouchableOpacity 
          style={styles.centerButton} 
          onPress={() => router.push("/leaderboard")}
        >
          <View style={styles.centerButtonInner}>
            <Ionicons name="trophy" size={28} color="#333" />
          </View>
          <Text style={styles.navLabel}>Leaderboard</Text>
        </TouchableOpacity>
        
        {/* Happening */}
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/happening")}>
          <Ionicons name="restaurant-outline" size={24} color="#333" />
          <Text style={styles.navLabel}>Happening</Text>
        </TouchableOpacity>
        
        {/* Profile */}
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/profile")}>
          <Ionicons name="person-outline" size={24} color="#333" />
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
  container: { 
    flex: 1, 
    backgroundColor: "#fff" 
  },
  
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },

  /* Header Container */
  headerContainer: {
    position: "relative",
    marginBottom: 30,
  },

  /* Gradient Header - With Rounded Bottom Corners */
  gradientHeader: {
    paddingTop: 50,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerTitle: {
    fontFamily: "Lobster",
    fontSize: 32,
    color: "#fff",
    textAlign: "center",
    letterSpacing: 1,
  },

  /* Search Bar - Overlapping gradient edge */
  searchBoxWrapper: {
    position: "absolute",
    bottom: -25,
    left: 16,
    right: 16,
    zIndex: 10,
  },

  searchBox: {
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },

  searchIcon: {
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },

  /* Grid Tiles */
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 4,
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
    padding: 6,
    borderRadius: 20,
  },

  /* Bottom Navigation with Labels */
  navBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },

  navLabel: {
    fontSize: 9,
    color: "#333",
    marginTop: 4,
  },

  centerButton: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -25,
  },

  centerButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#333",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
});