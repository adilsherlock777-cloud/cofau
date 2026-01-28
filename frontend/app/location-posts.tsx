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
  const posts = JSON.parse(params.posts as string || "[]");
  const locationName = params.locationName as string || "Posts at this location";

  const handlePostPress = (postId: string) => {
    router.push(`/post-details/${postId}`);
  };

  const renderPost = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.postCard} 
      onPress={() => handlePostPress(item.id)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: fixUrl(item.thumbnail_url || item.media_url) }}
        style={styles.postImage}
        contentFit="cover"
      />
      <View style={styles.postInfo}>
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            {item.user_profile_picture ? (
              <Image
                source={{ uri: fixUrl(item.user_profile_picture) }}
                style={styles.userAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.userAvatarPlaceholder}>
                <Ionicons name="person" size={14} color="#fff" />
              </View>
            )}
            <Text style={styles.username}>{item.username}</Text>
          </View>
          {item.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
          )}
        </View>
        
        {item.review_text && (
          <Text style={styles.reviewText} numberOfLines={2}>
            {item.review_text}
          </Text>
        )}
        
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={14} color="#E94A37" />
            <Text style={styles.statText}>{item.likes_count || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble" size={14} color="#1B7C82" />
            <Text style={styles.statText}>{item.comments_count || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#E94A37", "#F2CF68", "#1B7C82"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="location" size={20} color="#fff" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {locationName}
          </Text>
        </View>
        <View style={styles.postCount}>
          <Text style={styles.postCountText}>{posts.length} posts</Text>
        </View>
      </LinearGradient>

      {/* Posts List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
    color: "#fff",
    flex: 1,
  },
  postCount: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  postCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  listContainer: {
    padding: 16,
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  postImage: {
    width: "100%",
    height: 200,
  },
  postInfo: {
    padding: 12,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1B7C82",
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E94A37",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  reviewText: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
    lineHeight: 18,
  },
  postStats: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: "#666",
  },
});