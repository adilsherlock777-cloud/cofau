import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Image } from "expo-image";

// =======================
//  CONFIG
// =======================
const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLUMNS = 3;
const SPACING = 2;
const TILE_SIZE = (SCREEN_WIDTH - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

// ------------------------------------------------------------
// 🔥 UNIVERSAL URL FIXER
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
export default function LocationDetailsScreen() {
  const router = useRouter();
  const { locationName } = useLocalSearchParams();
  const { user, token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [locationInfo, setLocationInfo] = useState<any>(null);

  const decodedLocationName = locationName
    ? decodeURIComponent(locationName as string)
    : "";

  useEffect(() => {
    if (user && token && decodedLocationName) {
      fetchLocationPosts();
    }
  }, [user, token, decodedLocationName]);

  // ================================
  // 🔥 Fetch Location Posts
  // ================================
  const fetchLocationPosts = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        `${API_URL}/locations/details/${encodeURIComponent(decodedLocationName)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const locationData = res.data;
      setLocationInfo({
        name: locationData.location,
        uploads: locationData.uploads,
      });

      const formattedPosts = locationData.posts.map((post: any) => {
        const rawUrl = post.media_url || post.image_url;
        const fullUrl = fixUrl(rawUrl);

        return {
          ...post,
          full_image_url: fullUrl,
          is_liked: false, // You can add like status if needed
          _isVideo: isVideoFile(fullUrl, post.media_type),
        };
      });

      setPosts(formattedPosts);
    } catch (err) {
      console.error("❌ Location details fetch error:", err);
    } finally {
      setLoading(false);
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
        <Text>Loading posts…</Text>
      </View>
    );

  // ==================================
  // MAIN UI
  // ==================================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {locationInfo?.name || decodedLocationName}
          </Text>
          {locationInfo && (
            <Text style={styles.headerSubtitle}>
              {locationInfo.uploads} {locationInfo.uploads === 1 ? "post" : "posts"}
            </Text>
          )}
        </View>
      </View>

      {/* Grid */}
      {posts.length > 0 ? (
        <FlatList
          data={posts}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          columnWrapperStyle={{
            gap: SPACING,
            paddingHorizontal: SPACING,
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No posts found</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No posts for this location</Text>
          <Text style={styles.emptySubtext}>
            Be the first to post about {decodedLocationName}!
          </Text>
        </View>
      )}
    </View>
  );
}

// =======================
//  STYLES
// =======================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
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
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

