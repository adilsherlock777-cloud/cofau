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
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
const TILE_SIZE = Math.floor((SCREEN_WIDTH - SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS);
const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

type TabType = "nearby" | "posts" | "places" | "restaurants";

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
  const [nearbyPosts, setNearbyPosts] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState<{ [key: string]: boolean }>({});
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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
      deriveLocationsFromPosts(formattedPosts);
    } catch (err) {
      console.error("❌ Post search error:", err);
      setPosts([]);
      setLocations([]);
    }
  };

  const performRestaurantSearch = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setRestaurants([]);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/search/restaurants`, {
        params: { q: query.trim(), limit: 20 },
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      setRestaurants(res.data || []);
    } catch (err) {
      console.error("❌ Restaurant search error:", err);
      setRestaurants([]);
    }
  };

  const deriveLocationsFromPosts = (searchPosts: any[]) => {
    const locationMap: { [key: string]: any } = {};

    searchPosts.forEach((post) => {
      const locationName = post.location_name;
      if (!locationName) return;

      if (!locationMap[locationName]) {
        locationMap[locationName] = {
          name: locationName,
          total_posts: 0,
          all_images: [],
        };
      }

      locationMap[locationName].total_posts += 1;
      const mediaUrl = post.media_url || post.image_url;
      if (mediaUrl) {
        locationMap[locationName].all_images.push({
          post_id: post.id,
          media_url: fixUrl(mediaUrl),
          media_type: post.media_type || "image",
        });
      }
    });

    const sorted = Object.values(locationMap).sort(
      (a: any, b: any) => b.total_posts - a.total_posts
    );

    setLocations(sorted);
  };

  const toggleLocation = (locationName: string) => {
    setExpandedLocations((prev) => ({
      ...prev,
      [locationName]: !prev[locationName],
    }));
  };

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Please enable location access to see nearby posts.",
          [{ text: "OK" }]
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(userLoc);
      return userLoc;
    } catch (err) {
      console.error("❌ Error getting location:", err);
      Alert.alert("Error", "Could not get your location. Please try again.");
      return null;
    }
  };

  const performNearbySearch = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setNearbyPosts([]);
      return;
    }

    try {
      // Get user location first
      const location = userLocation || await getUserLocation();
      if (!location) {
        setNearbyPosts([]);
        return;
      }

      const url = `${API_URL}/map/search?q=${encodeURIComponent(query.trim())}&lat=${location.latitude}&lng=${location.longitude}&radius_km=12`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });

      const postsArray = Array.isArray(res.data) ? res.data : (res.data.results || []);
      const formattedPosts = postsArray.map((post: any) => {
        const rawUrl = post.media_url || post.image_url;
        const fullUrl = fixUrl(rawUrl);

        return {
          ...post,
          full_image_url: fullUrl,
          _isVideo: isVideoFile(fullUrl || "", post.media_type || "image"),
        };
      });

      setNearbyPosts(formattedPosts);
    } catch (err) {
      console.error("❌ Nearby posts search error:", err);
      setNearbyPosts([]);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setUsers([]);
      setPosts([]);
      setLocations([]);
      setNearbyPosts([]);
      setRestaurants([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await Promise.all([
        performUserSearch(query),
        performPostSearch(query),
        performNearbySearch(query),
        performRestaurantSearch(query),
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
      setNearbyPosts([]);
      setRestaurants([]);
      setLoading(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, token]);

  // Get user location on mount for nearby posts
  useEffect(() => {
    getUserLocation();
  }, []);

  const renderUserItem = ({ item }: any) => {
    const hasLocationImages = item.location_images && item.location_images.length > 0;
    
    return (
      <View style={styles.userItemContainer}>
        <TouchableOpacity
          style={styles.userItem}
          activeOpacity={0.7}
          onPress={() => router.push(`/user-profile/${item.id}`)}
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

    const countValue = item._isVideo ? (item.views_count || 0) : (item.clicks_count || 0);
    const countDisplay = countValue > 1000 ? `${(countValue / 1000).toFixed(1)}K` : countValue;

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
        <View style={styles.clicksBadge}>
          {item._isVideo ? (
            <Ionicons name="eye-outline" size={9} color="#fff" />
          ) : (
            <MaterialCommunityIcons name="gesture-tap" size={10} color="#fff" />
          )}
          <Text style={styles.clicksText}>{countDisplay}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLocationItem = ({ item }: any) => {
    // Use all_images if available, otherwise fall back to sample_photos
    const imagesToShow = item.all_images && item.all_images.length > 0
      ? item.all_images
      : (item.sample_photos || []);

    const isExpanded = expandedLocations[item.name] || false;

    return (
      <View style={styles.placesLocationSection}>
        {/* Location Header - Collapsible */}
        <TouchableOpacity
          style={styles.placesLocationHeader}
          onPress={() => toggleLocation(item.name)}
          activeOpacity={0.7}
        >
          <View style={styles.placesLocationHeaderLeft}>
            <Ionicons name="location" size={20} color="#E94A37" />
            <Text style={styles.placesLocationName} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={styles.placesLocationHeaderRight}>
            <Text style={styles.placesLocationCount}>
              ({item.total_posts})
            </Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#666"
            />
          </View>
        </TouchableOpacity>

        {/* Photos Grid - Show when expanded (favourite style) */}
        {isExpanded && imagesToShow.length > 0 && (
          <View style={styles.placesPostsGrid}>
            {imagesToShow.map((photo: any, index: number) => {
              const isVideo = photo.media_type === "video";
              const photoUrl = fixUrl(photo.media_url);

              return (
                <TouchableOpacity
                  key={photo.post_id || index}
                  style={styles.placesGridItem}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/post-details/${photo.post_id}`)}
                >
                  {photoUrl ? (
                    <View style={styles.placesGridImageContainer}>
                      <Image
                        source={{ uri: photoUrl }}
                        style={styles.placesGridImage}
                        placeholder={{ blurhash: BLUR_HASH }}
                        cachePolicy="memory-disk"
                        contentFit="cover"
                      />
                      {isVideo && (
                        <View style={styles.videoOverlay}>
                          <Ionicons name="play-circle" size={32} color="#fff" />
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.gridPlaceholder}>
                      <Ionicons
                        name={isVideo ? "videocam-outline" : "image-outline"}
                        size={32}
                        color="#ccc"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderPostsGrid = (postsData: any[] = posts, emptyMessage: string = "No posts found") => {
    if (postsData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          {searchQuery.trim() ? (
            <>
              <Ionicons name="images-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>{emptyMessage}</Text>
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

    return (
      <ScrollView
        style={styles.postsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View style={styles.postsGrid}>
          {postsData.map((post, index) => (
            <View
              key={post.id}
              style={[
                styles.gridItemWrapper,
                (index + 1) % NUM_COLUMNS === 0 && { marginRight: 0 }
              ]}
            >
              {renderPostItem({ item: post })}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderRestaurantItem = ({ item }: any) => {
    const profilePic = fixUrl(item.profile_picture);

    return (
      <TouchableOpacity
        style={styles.restaurantCard}
        activeOpacity={0.7}
        onPress={() => router.push(`/user-profile/${item.id}`)}
      >
        <UserAvatar
          profilePicture={profilePic}
          username={item.restaurant_name}
          size={56}
          showLevelBadge={false}
          style={{}}
        />
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName} numberOfLines={1}>{item.restaurant_name}</Text>
          {item.location && (
            <View style={styles.restaurantLocationRow}>
              <Ionicons name="location-outline" size={13} color="#999" />
              <Text style={styles.restaurantLocation} numberOfLines={1}>{item.location}</Text>
            </View>
          )}
          {item.matching_menu_items && item.matching_menu_items.length > 0 && (
            <View style={styles.menuMatchRow}>
              <Ionicons name="restaurant-outline" size={13} color="#E94A37" />
              <Text style={styles.menuMatchText} numberOfLines={1}>
                {item.matching_menu_items.map((m: any) => m.name).join(", ")}
              </Text>
            </View>
          )}
          <View style={styles.restaurantStatsRow}>
            <Text style={styles.restaurantStat}>{item.post_count || 0} posts</Text>
            <Text style={styles.restaurantStatDot}> · </Text>
            <Text style={styles.restaurantStat}>{item.follower_count || 0} followers</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E94A37" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case "nearby":
        return renderPostsGrid(nearbyPosts, "No nearby posts found");

      case "posts":
        return renderPostsGrid(posts, "No posts found");

      case "restaurants":
        return (
          <FlatList
            data={restaurants}
            renderItem={renderRestaurantItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              searchQuery.trim() ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="storefront-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No restaurants found</Text>
                  <Text style={styles.emptySubtext}>
                    Try searching for a dish or restaurant name
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Search for dishes to find restaurants</Text>
                </View>
              )
            }
          />
        );

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
          placeholder="Search by dish, name, or location..."
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
          style={[styles.tab, activeTab === "nearby" && styles.activeTab]}
          onPress={() => setActiveTab("nearby")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "nearby" && styles.activeTabText,
            ]}
          >
            Near me
          </Text>
          {activeTab === "nearby" && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "restaurants" && styles.activeTab]}
          onPress={() => setActiveTab("restaurants")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "restaurants" && styles.activeTabText,
            ]}
          >
            Restaurants
          </Text>
          {activeTab === "restaurants" && <View style={styles.tabIndicator} />}
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
    backgroundColor: "#E94A37",
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
  clicksBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  clicksText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "600",
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
  postsLocationSection: {
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  postsLocationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  postsLocationHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  postsLocationHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postsLocationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  postsLocationCount: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  placesLocationSection: {
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  placesLocationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  placesLocationHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  placesLocationHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  placesLocationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  placesLocationCount: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  postsContainer: {
    flex: 1,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingHorizontal: SPACING,
    marginBottom: SPACING,
  },
  gridItemWrapper: {
    width: TILE_SIZE,
    marginRight: SPACING,
    marginBottom: SPACING,
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
  // Favourite-style grid for Places tab
  placesPostsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 2,
  },
  placesGridItem: {
    width: (SCREEN_WIDTH - 38) / 3,
    height: (SCREEN_WIDTH - 38) / 3,
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  placesGridImageContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  placesGridImage: {
    width: "100%",
    height: "100%",
  },
  videoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  gridPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
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
  // Restaurant card styles
  restaurantCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  restaurantLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  restaurantLocation: {
    fontSize: 13,
    color: "#999",
    flex: 1,
  },
  menuMatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  menuMatchText: {
    fontSize: 13,
    color: "#E94A37",
    fontWeight: "500",
    flex: 1,
  },
  restaurantStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  restaurantStat: {
    fontSize: 12,
    color: "#999",
  },
  restaurantStatDot: {
    fontSize: 12,
    color: "#ccc",
  },
});

