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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const SCREEN_WIDTH = Dimensions.get("window").width;

const fixUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  let cleaned = url.trim().replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return `${API_BASE_URL}${cleaned}`;
};

export default function LocationPostsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const posts = JSON.parse(params.posts as string || "[]").sort(
    (a: any, b: any) => (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime())
  );
  const locationName = params.locationName as string || "Posts at this location";

  const handlePostPress = (postId: string) => {
    router.push(`/post-details/${postId}`);
  };

  const formatCount = (count: number) => {
    if (!count) return '0';
    return count > 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
  };

  const renderPost = ({ item }: any) => {
    const mediaUrl = fixUrl(item.thumbnail_url || item.media_url);
    const isVideo = item.media_type === 'video' ||
                    mediaUrl?.toLowerCase().endsWith('.mp4') ||
                    mediaUrl?.toLowerCase().endsWith('.mov');
    const clicksCount = item.clicks_count || 0;
    const viewsCount = item.views_count || 0;
    const dishName = item.dish_name;

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => handlePostPress(item.id)}
        activeOpacity={0.8}
      >
        {mediaUrl && (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.gridImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item.id}
          />
        )}

        {/* Video indicator */}
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Ionicons name="play-circle" size={24} color="#fff" />
          </View>
        )}

        {/* Clicks/Views badge */}
        {(clicksCount > 0 || viewsCount > 0) && (
          <View style={styles.clicksBadge}>
            <Ionicons name="eye-outline" size={10} color="#fff" />
            <Text style={styles.clicksText}>{formatCount(viewsCount || clicksCount)}</Text>
          </View>
        )}

        {/* Dish name tag */}
        {dishName && (
          <View style={styles.dishTag}>
            <Text style={styles.dishText} numberOfLines={1}>{dishName}</Text>
          </View>
        )}

        {/* Rating badge */}
        {item.rating && (
          <View style={styles.ratingBadgeGrid}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.ratingTextGrid}>{item.rating}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#FFF5F0", "#FFE5D9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="location" size={20} color="#FF2E2E" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {locationName}
          </Text>
        </View>
        <View style={styles.postCount}>
          <Text style={styles.postCountText}>{posts.length} posts</Text>
        </View>
      </LinearGradient>

      {/* Posts Grid */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        numColumns={3}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  postCount: {
    backgroundColor: "rgba(255, 46, 46, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  postCountText: {
    color: "#FF2E2E",
    fontSize: 12,
    fontWeight: "600",
  },
  listContainer: {
    paddingTop: 8,
  },
  columnWrapper: {
    gap: 1,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 2) / 3,
    height: (SCREEN_WIDTH - 2) / 3,
    margin: 0.5,
    position: "relative",
    backgroundColor: "#f0f0f0",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  videoIndicator: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    padding: 4,
  },
  ratingBadgeGrid: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(233, 74, 55, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 2,
  },
  ratingTextGrid: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  clicksBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  clicksText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  dishTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(233, 74, 55, 0.85)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: "80%",
  },
  dishText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
});