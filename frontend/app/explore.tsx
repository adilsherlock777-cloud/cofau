import React, { useState, useCallback, useMemo } from "react";
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
import { Image } from "expo-image"; // Better caching
import { likePost, unlikePost } from "../utils/api";

// API CONFIG
const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://backend.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

// Grid
const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLUMNS = 3;
const SPACING = 2;
const TILE_SIZE = (SCREEN_WIDTH - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I"; // Placeholder blur

export default function ExploreScreen() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      if (user && token) fetchPosts(true);
    }, [user, token])
  );

  // Fetch explore posts
  const fetchPosts = async (refresh = false) => {
    try {
      if (refresh) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const skip = refresh ? 0 : (page - 1) * 30;

      const res = await axios.get(`${API_URL}/feed?limit=30&skip=${skip}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newPosts = res.data.map((post) => {
        const raw = post.media_url || post.image_url;

        const fullUrl =
          raw && raw.startsWith("http")
            ? raw
            : `${API_BASE_URL}${raw.startsWith("/") ? raw : "/" + raw}`;

        const thumb =
          post.thumbnail_url && !post.thumbnail_url.startsWith("http")
            ? `${API_BASE_URL}${
                post.thumbnail_url.startsWith("/")
                  ? post.thumbnail_url
                  : "/" + post.thumbnail_url
              }`
            : post.thumbnail_url;

        return {
          ...post,
          full_image_url: fullUrl,
          full_thumbnail_url: thumb || null,
          is_liked: post.is_liked_by_user || false,
        };
      });

      refresh ? setPosts(newPosts) : setPosts((p) => [...p, ...newPosts]);

      setHasMore(newPosts.length >= 30);
      setPage((prev) => prev + 1);
    } catch (err) {
      console.error("❌ Explore fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Search filter
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;

    return posts.filter((p) =>
      (p.caption || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, posts]);

  // Like/unlike
  const handleLike = async (id, liked) => {
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

  // Render grid tile
  const renderGridItem = ({ item }) => {
    // For videos → show thumbnail
    const displayImage =
      item.media_type === "video"
        ? item.full_thumbnail_url
        : item.full_image_url;

    return (
      <TouchableOpacity
        style={styles.tile}
        activeOpacity={0.85}
        onPress={() => router.push(`/post-details/${item.id}`)}
      >
        <Image
          source={displayImage}
          style={styles.gridImage}
          cachePolicy="memory-disk"
          placeholder={{ blurhash: BLUR_HASH }}
          contentFit="cover"
          transition={300}
        />

        {/* Play Icon for videos */}
        {item.media_type === "video" && (
          <View style={styles.playIcon}>
            <Ionicons name="play-circle" size={26} color="#fff" />
          </View>
        )}

        {/* Like button */}
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

  // Loading states
  if (!user || !token)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text>Authenticating...</Text>
      </View>
    );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text>Loading explore…</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search posts…"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Ionicons name="search" size={20} color="#777" />
      </View>

      {/* Grid */}
      <FlatList
        data={filteredPosts}
        renderItem={renderGridItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        columnWrapperStyle={{
          gap: SPACING,
          paddingHorizontal: SPACING,
        }}
        onEndReached={() => fetchPosts(false)}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
      />
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

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
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 4,
    borderRadius: 20,
  },

  likeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 4,
    borderRadius: 20,
  },
});
