import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import UserAvatar from "../components/UserAvatar";
import { Image } from "expo-image";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get("window").width;
const NUM_COLUMNS = 3;
const SPACING = 2;
const TILE_SIZE = (SCREEN_WIDTH - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

type TabType = "users" | "posts" | "places";

const fixUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  let cleaned = url.trim();
  cleaned = cleaned.replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;

  return `${API_BASE_URL}${cleaned}`;
};

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

export default function SearchResultsScreen() {
  const router = useRouter();
  const { query } = useLocalSearchParams<{ query: string }>();
  const { token } = useAuth() as { token: string | null };

  const [searchQuery, setSearchQuery] = useState(query || "");
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performUserSearch = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setUsers([]);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/search/users`, {
        params: { q: query.trim(), limit: 100 },
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      const searchUsers = res.data.map((user: any) => ({
        id: user.id,
        full_name: user.full_name || user.username,
        username: user.username,
        profile_picture: fixUrl(user.profile_picture),
        level: user.level || 1,
      }));

      setUsers(searchUsers);
    } catch (err) {
      console.error("❌ User search error:", err);
      setUsers([]);
    }
  };

  const performPostSearch = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setPosts([]);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/search/posts`, {
        params: { q: query.trim(), limit: 100 },
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      const formattedPosts = res.data.map((post: any) => {
        const rawUrl = post.media_url || post.image_url;
        const fullUrl = fixUrl(rawUrl);

        return {
          ...post,
          full_image_url: fullUrl,
          _isVideo: isVideoFile(fullUrl || "", post.media_type || "image"),
        };
      });

      setPosts(formattedPosts);
    } catch (err) {
      console.error("❌ Post search error:", err);
      setPosts([]);
    }
  };

  const performLocationSearch = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setLocations([]);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/search/locations`, {
        params: { q: query.trim(), limit: 20 },
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      const formattedLocations = res.data.map((location: any) => ({
        ...location,
        sample_photos: (location.sample_photos || []).map((photo: any) => ({
          ...photo,
          media_url: fixUrl(photo.media_url),
        })),
      }));

      setLocations(formattedLocations);
    } catch (err) {
      console.error("❌ Location search error:", err);
      setLocations([]);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setUsers([]);
      setPosts([]);
      setLocations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await Promise.all([
        performUserSearch(query),
        performPostSearch(query),
        performLocationSearch(query),
      ]);
    } catch (err) {
      console.error("❌ Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search - auto-search after 3 characters
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If query is from URL params, search immediately
    if (query && searchQuery === query) {
      performSearch(searchQuery);
      return;
    }

    // Auto-search if query has at least 3 characters
    if (searchQuery.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 500); // 500ms debounce
    } else {
      setUsers([]);
      setPosts([]);
      setLocations([]);
      setLoading(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, token]);

  const renderUserItem = ({ item }: any) => {
    const hasLocationImages = item.location_images && item.location_images.length > 0;
    
    return (
      <View style={styles.userItemContainer}>
        <TouchableOpacity
          style={styles.userItem}
          activeOpacity={0.7}
          onPress={() => router.push(`/profile?userId=${item.id}`)}
        >
          <UserAvatar
            profilePicture={item.profile_picture}
            username={item.full_name || item.username}
            size={60}
            level={item.level}
            showLevelBadge={false}
            style={{}}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.full_name || item.username}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
        {hasLocationImages && (
          <View style={styles.userLocationImagesContainer}>
            <Text style={styles.userLocationImagesTitle}>Location Photos</Text>
            <View style={styles.userLocationGrid}>
              {item.location_images.slice(0, 9).map((photo: any, index: number) => (
                <TouchableOpacity
                  key={photo.post_id || index}
                  style={styles.userLocationGridItem}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/post-details/${photo.post_id}`)}
                >
                  <Image
                    source={fixUrl(photo.media_url)}
                    style={styles.userLocationGridImage}
                    placeholder={{ blurhash: BLUR_HASH }}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                  />
                  {photo.media_type === "video" && (
                    <View style={styles.playIconSmall}>
                      <Ionicons name="play-circle" size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderPostItem = ({ item }: any) => {
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
        {item.location_name && (
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={12} color="#fff" />
            <Text style={styles.locationBadgeText} numberOfLines={1}>
              {item.location_name}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderLocationItem = ({ item }: any) => {
    // Use all_images if available, otherwise fall back to sample_photos
    const imagesToShow = item.all_images && item.all_images.length > 0 
      ? item.all_images 
      : (item.sample_photos || []);
    
    return (
      <View style={styles.locationCard}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            router.push(
              `/location-details?locationName=${encodeURIComponent(item.name)}`
            )
          }
        >
          <View style={styles.locationHeader}>
            <Ionicons name="location" size={20} color="#4dd0e1" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationName}>{item.name}</Text>
              <Text style={styles.locationPostCount}>
                {item.total_posts} {item.total_posts === 1 ? "post" : "posts"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {imagesToShow.length > 0 && (
          <View style={styles.locationGrid}>
            {imagesToShow.map((photo: any, index: number) => (
              <TouchableOpacity
                key={photo.post_id || index}
                style={styles.locationGridItem}
                activeOpacity={0.9}
                onPress={() => router.push(`/post-details/${photo.post_id}`)}
              >
                <Image
                  source={fixUrl(photo.media_url)}
                  style={styles.locationGridImage}
                  placeholder={{ blurhash: BLUR_HASH }}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                />
                {photo.media_type === "video" && (
                  <View style={styles.playIconSmall}>
                    <Ionicons name="play-circle" size={20} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPostsWithLocationGroups = () => {
    if (posts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          {searchQuery.trim() ? (
            <>
              <Ionicons name="images-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No posts found</Text>
              <Text style={styles.emptySubtext}>
                Try searching for a different name or location
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Enter a name or location to search</Text>
            </>
          )}
        </View>
      );
    }

    // Group posts by location_name
    const locationGroups: { [key: string]: any[] } = {};
    const postsWithoutLocation: any[] = [];

    posts.forEach((post) => {
      if (post.location_name) {
        if (!locationGroups[post.location_name]) {
          locationGroups[post.location_name] = [];
        }
        locationGroups[post.location_name].push(post);
      } else {
        postsWithoutLocation.push(post);
      }
    });

    return (
      <ScrollView
        style={styles.postsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Render location groups */}
        {Object.entries(locationGroups).map(([locationName, locationPosts]) => (
          <View key={locationName}>
            {locationPosts.length > 1 && (
              <View style={styles.locationHeaderRow}>
                <Ionicons name="location" size={18} color="#4dd0e1" />
                <Text style={styles.locationHeaderText}>
                  {locationName} ({locationPosts.length} posts)
                </Text>
              </View>
            )}
            <View style={styles.postsGrid}>
              {locationPosts.map((post) => (
                <View key={post.id} style={styles.gridItemWrapper}>
                  {renderPostItem({ item: post })}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Render posts without location */}
        {postsWithoutLocation.length > 0 && (
          <View style={styles.postsGrid}>
            {postsWithoutLocation.map((post) => (
              <View key={post.id} style={styles.gridItemWrapper}>
                {renderPostItem({ item: post })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4dd0e1" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case "users":
        return (
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              searchQuery.trim() ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="person-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No users found</Text>
                  <Text style={styles.emptySubtext}>
                    Try searching for a different name
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Enter a name to search</Text>
                </View>
              )
            }
          />
        );

      case "posts":
        return renderPostsWithLocationGroups();

      case "places":
        return (
          <FlatList
            data={locations}
            renderItem={renderLocationItem}
            keyExtractor={(item, index) => item.name || `location-${index}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }}
            ListEmptyComponent={
              searchQuery.trim() ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="location-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No places found</Text>
                  <Text style={styles.emptySubtext}>
                    Try searching for a different location
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Enter a location to search</Text>
                </View>
              )
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#777" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or location..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoFocus={!query}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "posts" && styles.activeTab]}
          onPress={() => setActiveTab("posts")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "posts" && styles.activeTabText,
            ]}
          >
            Posts
          </Text>
          {activeTab === "posts" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "users" && styles.activeTab]}
          onPress={() => setActiveTab("users")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "users" && styles.activeTabText,
            ]}
          >
            Users
          </Text>
          {activeTab === "users" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "places" && styles.activeTab]}
          onPress={() => setActiveTab("places")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "places" && styles.activeTabText,
            ]}
          >
            Places
          </Text>
          {activeTab === "places" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Results */}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  headerSpacer: {
    width: 40,
  },
  searchBox: {
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#f2f2f2",
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  activeTab: {},
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#999",
  },
  activeTabText: {
    color: "#333",
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#4dd0e1",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  userItemContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  userLocationImagesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    marginTop: 8,
  },
  userLocationImagesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  userLocationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -2,
  },
  userLocationGridItem: {
    width: (SCREEN_WIDTH - 64) / 3,
    height: (SCREEN_WIDTH - 64) / 3,
    margin: 2,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  userLocationGridImage: {
    width: "100%",
    height: "100%",
  },
  playIconSmall: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -10 }, { translateY: -10 }],
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
  },
  // Grid styles for posts
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    marginBottom: SPACING,
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
    borderRadius: 2,
  },
  playIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -14 }, { translateY: -14 }],
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 14,
  },
  locationBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  locationBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
    marginLeft: 4,
    flex: 1,
  },
  locationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  locationHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  postsContainer: {
    flex: 1,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING,
    marginBottom: SPACING,
  },
  gridItemWrapper: {
    width: TILE_SIZE,
    marginRight: SPACING,
  },
  // Location card styles
  locationCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  locationPostCount: {
    fontSize: 13,
    color: "#999",
  },
  locationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  locationGridItem: {
    width: (SCREEN_WIDTH - 64) / 3,
    height: (SCREEN_WIDTH - 64) / 3,
    marginRight: 4,
    marginBottom: 4,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  locationGridImage: {
    width: "100%",
    height: "100%",
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
});

