import React, { useState, useCallback, useEffect, useRef, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
  LayoutChangeEvent,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { Image } from "expo-image";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { likePost, unlikePost } from "../utils/api";
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from "react-native-maps";
import * as Location from "expo-location";

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const SPACING = 2;
const COLUMN_WIDTH = (SCREEN_WIDTH - SPACING * 3) / 3;
const SQUARE_HEIGHT = COLUMN_WIDTH;
const VERTICAL_HEIGHT = COLUMN_WIDTH * 1.5;
const SMALL_HEIGHT = COLUMN_WIDTH * 0.75;
const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const MAX_CONCURRENT_VIDEOS = 2;


const fixUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  let cleaned = url.trim().replace(/([^:]\/)\/+/g, "$1");
  if (!cleaned.startsWith("/")) cleaned = "/" + cleaned;
  return `${API_BASE_URL}${cleaned}`;
};

const isVideoFile = (url: string, media_type: string) => {
  if (media_type === "video") return true;
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".mkv") || lower.includes(".webm");
};

const getTileHeight = (post: any) => {
  const isVideo = post._isVideo;
  const aspectRatio = post.aspect_ratio || (isVideo ? 0.5625 : 1);
  if (isVideo) {
    if (aspectRatio <= 0.6) return VERTICAL_HEIGHT;
    if (aspectRatio <= 0.8) return COLUMN_WIDTH * 1.25;
    return SQUARE_HEIGHT;
  }
  if (aspectRatio < 0.8) return VERTICAL_HEIGHT;
  if (aspectRatio > 1.2) return SMALL_HEIGHT;
  return SQUARE_HEIGHT;
};

const GradientHeart = ({ size = 18 }) => (
  <MaskedView maskElement={<View style={{ backgroundColor: "transparent" }}><Ionicons name="heart" size={size} color="#000" /></View>}>
    <LinearGradient colors={["#E94A37", "#F2CF68", "#1B7C82"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size }} />
  </MaskedView>
);

const distributePosts = (posts: any[]) => {
  const columns: any[][] = [[], [], []];
  const heights = [0, 0, 0];
  posts.forEach((post) => {
    const height = getTileHeight(post);
    const shortestIndex = heights.indexOf(Math.min(...heights));
    columns[shortestIndex].push({ ...post, tileHeight: height });
    heights[shortestIndex] += height + SPACING;
  });
  return columns;
};

const VideoTile = memo(({ item, onPress, onLike, shouldPlay, onLayout }: any) => {
  const videoRef = useRef<Video>(null);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);

  useEffect(() => {
  const controlVideo = async () => {
    if (!videoRef.current) return;
    try {
      if (shouldPlay) {
        const status = await videoRef.current.getStatusAsync();
        if (!status.isLoaded) {
          await videoRef.current.loadAsync(
            { uri: item.full_image_url },
            { shouldPlay: true, isLooping: true, isMuted: true }
          );
        } else {
          await videoRef.current.setPositionAsync(0);
          await videoRef.current.playAsync();
        }
      } else {
        await videoRef.current.pauseAsync();
      }
    } catch (e) {
      console.log("Video control error:", e);
    }
  };
  controlVideo();
}, [shouldPlay, item.full_image_url]);

  const displayThumbnail = item.full_thumbnail_url || item.full_image_url;

  return (
    <TouchableOpacity style={[styles.tile, { height: item.tileHeight }]} activeOpacity={0.9} onPress={() => onPress(item.id)} onLayout={(e) => onLayout(item.id, e)}>
      <Video 
  ref={videoRef} 
  source={{ uri: item.full_image_url }} 
  style={styles.tileVideo} 
  resizeMode={ResizeMode.COVER} 
  isLooping 
  isMuted={true}
  useNativeControls={false}
  shouldPlay={false}
  posterSource={{ uri: item.full_thumbnail_url || item.full_image_url }}
  usePoster={true}
  onPlaybackStatusUpdate={(status: AVPlaybackStatus) => { 
    if (status.isLoaded) setIsActuallyPlaying(status.isPlaying); 
  }} 
/>
      {!isActuallyPlaying && (
        <>
          {displayThumbnail ? (
            <Image source={{ uri: displayThumbnail }} style={styles.thumbnailOverlay} placeholder={{ blurhash: BLUR_HASH }} cachePolicy="memory-disk" contentFit="cover" />
          ) : (
            <View style={[styles.thumbnailOverlay, styles.placeholderImage]}><Ionicons name="videocam-outline" size={32} color="#ccc" /></View>
          )}
          <View style={styles.playIconContainer}><Ionicons name="play" size={24} color="#fff" /></View>
        </>
      )}
      <TouchableOpacity style={styles.likeBtn} onPress={(e) => { e.stopPropagation(); onLike(item.id, item.is_liked); }}>
        {item.is_liked ? <GradientHeart size={18} /> : <Ionicons name="heart-outline" size={18} color="#ffffff" />}
      </TouchableOpacity>
      {item.views_count > 0 && (
        <View style={styles.viewsContainer}>
          <Ionicons name="play" size={12} color="#fff" />
          <Text style={styles.viewsText}>{item.views_count > 1000 ? `${(item.views_count / 1000).toFixed(1)}K` : item.views_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const ImageTile = memo(({ item, onPress, onLike }: any) => (
  <TouchableOpacity style={[styles.tile, { height: item.tileHeight }]} activeOpacity={0.9} onPress={() => onPress(item.id)}>
    {item.full_image_url ? (
      <Image source={{ uri: item.full_image_url }} style={styles.tileImage} placeholder={{ blurhash: BLUR_HASH }} cachePolicy="memory-disk" contentFit="cover" transition={200} />
    ) : (
      <View style={[styles.tileImage, styles.placeholderImage]}><Ionicons name="image-outline" size={32} color="#ccc" /></View>
    )}
    <TouchableOpacity style={styles.likeBtn} onPress={(e) => { e.stopPropagation(); onLike(item.id, item.is_liked); }}>
      {item.is_liked ? <GradientHeart size={18} /> : <Ionicons name="heart-outline" size={18} color="#ffffff" />}
    </TouchableOpacity>
  </TouchableOpacity>
));

const GridTile = ({ item, onPress, onLike, onVideoLayout, playingVideos }: any) => {
  if (item._isVideo) {
    return <VideoTile item={item} onPress={onPress} onLike={onLike} shouldPlay={playingVideos.includes(item.id)} onLayout={onVideoLayout} />;
  }
  return <ImageTile item={item} onPress={onPress} onLike={onLike} />;
};

// ======================================================
// CORRECTED MAP MARKERS - Copy these to your ExploreScreen.tsx
// ======================================================

const RestaurantMarker = memo(({ restaurant, onPress }: any) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  return (
    <Marker
      coordinate={{
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
      }}
      onPress={() => onPress(restaurant)}
      tracksViewChanges={!imageLoaded}
    >
      <View style={styles.restaurantMarkerContainer}>
        <View style={styles.restaurantMarkerBubble}>
          {restaurant.profile_picture ? (
            <Image
              source={{ uri: fixUrl(restaurant.profile_picture) }}
              style={styles.restaurantMarkerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <View style={styles.restaurantMarkerPlaceholder}>
              <Ionicons name="restaurant" size={16} color="#fff" />
            </View>
          )}
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>{restaurant.review_count}</Text>
          </View>
        </View>
        <View style={styles.markerArrow} />
      </View>
    </Marker>
  );
});

const PostMarker = memo(({ post, onPress }: any) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  return (
    <Marker
      coordinate={{
        latitude: post.latitude,
        longitude: post.longitude,
      }}
      onPress={() => onPress(post)}
      tracksViewChanges={!imageLoaded}
    >
      <View style={styles.postMarkerContainer}>
        <View style={styles.postMarkerBubble}>
          {post.thumbnail_url || post.media_url ? (
            <Image
              source={{ uri: fixUrl(post.thumbnail_url || post.media_url) }}
              style={styles.postMarkerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <View style={styles.postMarkerPlaceholder}>
              <Ionicons name="image" size={20} color="#fff" />
            </View>
          )}
          {post.rating && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingBadgeText}>{post.rating}</Text>
            </View>
          )}
        </View>
        <View style={styles.postMarkerArrow} />
      </View>
    </Marker>
  );
});

// ======================================================
// MAP VIEW COMPONENT
// ======================================================

const MapViewComponent = memo(({ 
  userLocation, 
  restaurants, 
  posts, 
  onRestaurantPress, 
  onPostPress,
  searchQuery,
  onSearch,
  isLoading,
  mapRef,
}: any) => {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery || "");

  const handleSearch = () => {
    if (localSearchQuery.trim()) {
      onSearch(localSearchQuery.trim());
    }
  };

  const handleClearSearch = () => {
    setLocalSearchQuery("");
    onSearch("");
  };

  return (
    <View style={styles.mapContainer}>
      {/* Search Bar */}
      <View style={styles.mapSearchContainer}>
      </View>

      {/* Map */}
      {userLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
        >
          {/* Restaurant Markers */}
          {restaurants.map((restaurant: any) => (
            <RestaurantMarker
              key={`restaurant-${restaurant.id}`}
              restaurant={restaurant}
              onPress={onRestaurantPress}
            />
          ))}

          {/* Post Markers */}
          {posts.map((post: any) => (
            <PostMarker
              key={`post-${post.id}`}
              post={post}
              onPress={onPostPress}
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.mapLoadingContainer}>
          <ActivityIndicator size="large" color="#4dd0e1" />
          <Text style={styles.mapLoadingText}>Getting your location...</Text>
        </View>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="small" color="#4dd0e1" />
        </View>
      )}

      {/* Results Count */}
      {(restaurants.length > 0 || posts.length > 0) && (
        <View style={styles.resultsCountContainer}>
          <Text style={styles.resultsCountText}>
            {restaurants.length} restaurants • {posts.length} posts nearby
          </Text>
        </View>
      )}
    </View>
  );
});

// ======================================================
// RESTAURANT DETAIL MODAL
// ======================================================

const RestaurantDetailModal = memo(({ visible, restaurant, onClose, onViewProfile }: any) => {
  if (!restaurant) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.detailModal}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.restaurantDetailHeader}>
            {restaurant.profile_picture ? (
              <Image
                source={{ uri: fixUrl(restaurant.profile_picture) }}
                style={styles.restaurantDetailImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.restaurantDetailPlaceholder}>
                <Ionicons name="restaurant" size={40} color="#fff" />
              </View>
            )}
            <View style={styles.restaurantDetailInfo}>
              <Text style={styles.restaurantDetailName}>{restaurant.name}</Text>
              {restaurant.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ECDC4" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
              <Text style={styles.restaurantDetailBio} numberOfLines={2}>
                {restaurant.bio || "No description available"}
              </Text>
            </View>
          </View>

          <View style={styles.restaurantStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{restaurant.review_count}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{restaurant.average_rating || "N/A"}</Text>
              <Text style={styles.statLabel}>Avg Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{restaurant.distance_km} km</Text>
              <Text style={styles.statLabel}>Away</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.viewProfileBtn} onPress={() => onViewProfile(restaurant)}>
            <LinearGradient
              colors={["#E94A37", "#F2CF68", "#1B7C82"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewProfileBtnGradient}
            >
              <Text style={styles.viewProfileBtnText}>View Restaurant Profile</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

// ======================================================
// POST DETAIL MODAL
// ======================================================

const PostDetailModal = memo(({ visible, post, onClose, onViewPost }: any) => {
  if (!post) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.detailModal}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.postDetailContent}>
            {post.media_url && (
              <Image
                source={{ uri: fixUrl(post.thumbnail_url || post.media_url) }}
                style={styles.postDetailImage}
                contentFit="cover"
              />
            )}
            
            <View style={styles.postDetailInfo}>
              <View style={styles.postUserRow}>
                {post.user_profile_picture ? (
                  <Image
                    source={{ uri: fixUrl(post.user_profile_picture) }}
                    style={styles.postUserAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.postUserAvatarPlaceholder}>
                    <Ionicons name="person" size={16} color="#fff" />
                  </View>
                )}
                <Text style={styles.postUsername}>{post.username}</Text>
              </View>

              {post.location_name && (
                <View style={styles.postLocationRow}>
                  <Ionicons name="location" size={14} color="#E94A37" />
                  <Text style={styles.postLocationText}>{post.location_name}</Text>
                </View>
              )}

              {post.category && (
                <View style={styles.postCategoryBadge}>
                  <Text style={styles.postCategoryText}>{post.category}</Text>
                </View>
              )}

              <Text style={styles.postReviewText} numberOfLines={3}>
                {post.review_text || "No review"}
              </Text>

              <View style={styles.postStats}>
                {post.rating && (
                  <View style={styles.postStatItem}>
                    <Ionicons name="star" size={14} color="#F2CF68" />
                    <Text style={styles.postStatText}>{post.rating}/10</Text>
                  </View>
                )}
                <View style={styles.postStatItem}>
                  <Ionicons name="heart" size={14} color="#E94A37" />
                  <Text style={styles.postStatText}>{post.likes_count}</Text>
                </View>
                <View style={styles.postStatItem}>
                  <Ionicons name="navigate" size={14} color="#1B7C82" />
                  <Text style={styles.postStatText}>{post.distance_km} km</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.viewProfileBtn} onPress={() => onViewPost(post)}>
            <LinearGradient
              colors={["#E94A37", "#F2CF68", "#1B7C82"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewProfileBtnGradient}
            >
              <Text style={styles.viewProfileBtnText}>View Full Post</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

// ======================================================
// MAIN EXPLORE SCREEN
// ======================================================

export default function ExploreScreen() {
  const router = useRouter();
  const auth = useAuth() as { user: any; token: string | null };
  const { user, token } = auth;

  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);
  const videoPositions = useRef<Map<string, { top: number; height: number }>>(new Map());

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'map' | 'users'>('map');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [playingVideos, setPlayingVideos] = useState<string[]>([]);

  // Map-specific state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRestaurants, setMapRestaurants] = useState<any[]>([]);
  const [mapPosts, setMapPosts] = useState<any[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedQuickCategory, setSelectedQuickCategory] = useState<string | null>(null);

  const POSTS_PER_PAGE = 30;
  const CATEGORIES = ["All", "Vegetarian/Vegan", "Non vegetarian", "Biryani", "Desserts", "SeaFood", "Chinese", "Chaats", "Arabic", "BBQ/Tandoor", "Fast Food", "Tea/Coffee", "Salad", "Karnataka Style", "Hyderabadi Style", "Kerala Style", "Andhra Style", "North Indian Style", "South Indian Style", "Punjabi Style", "Bengali Style", "Odia Style", "Gujurati Style", "Rajasthani Style", "Mangaluru Style", "Goan", "Kashmiri", "Continental", "Italian", "Japanese", "Korean", "Mexican", "Persian", "Drinks / sodas"];
  const QUICK_CATEGORIES = [
  { id: 'biryani', name: 'Biryani', emoji: '🍛' },
  { id: 'pizza', name: 'Pizza', emoji: '🍕' },
  { id: 'dosa', name: 'Dosa', emoji: '🥘' },
  { id: 'cafe', name: 'Cafe', emoji: '☕' },
  { id: 'chinese', name: 'Chinese', emoji: '🍜' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
  { id: 'fast-food', name: 'Fast Food', emoji: '🍔' },
  { id: 'bbq', name: 'BBQ', emoji: '🍗' },
  { id: 'seafood', name: 'SeaFood', emoji: '🦐' },
  { id: 'salad', name: 'Salad', emoji: '🥗' },
  { id: 'drinks', name: 'Drinks', emoji: '🍹' },
  { id: 'japanese', name: 'Japanese', emoji: '🍣' },
  { id: 'italian', name: 'Italian', emoji: '🍝' },
  { id: 'mexican', name: 'Mexican', emoji: '🌮' },
];
  // ======================================================
  // LOCATION PERMISSION & FETCH
  // ======================================================

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Please enable location access to see nearby restaurants and posts on the map.",
          [{ text: "OK" }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.log("Location permission error:", error);
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);
      return coords;
    } catch (error) {
      console.log("Get location error:", error);
      Alert.alert("Location Error", "Could not get your current location. Please try again.");
      return null;
    }
  };

  // ======================================================
  // MAP DATA FETCHING
  // ======================================================

  const fetchMapPins = async (searchTerm?: string) => {
    if (!userLocation) return;

    setMapLoading(true);
    try {
      let url: string;
      
      if (searchTerm && searchTerm.trim()) {
        // Search endpoint
        url = `${API_URL}/map/search?q=${encodeURIComponent(searchTerm)}&lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=10`;
      } else {
        // All pins endpoint
        url = `${API_URL}/map/pins?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=10`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });

      if (searchTerm && searchTerm.trim()) {
        // Search results only return posts
        setMapPosts(response.data.results || []);
        setMapRestaurants([]);
      } else {
        // All pins return both
        setMapRestaurants(response.data.restaurants || []);
        setMapPosts(response.data.posts || []);
      }
    } catch (error) {
      console.log("Fetch map pins error:", error);
    } finally {
      setMapLoading(false);
    }
  };

  const handleMapSearch = (query: string) => {
    setMapSearchQuery(query);
    if (query.trim()) {
      fetchMapPins(query);
    } else {
      fetchMapPins();
    }
  };

  const handleQuickCategoryPress = (category: any) => {
  if (selectedQuickCategory === category.id) {
    // Deselect if already selected
    setSelectedQuickCategory(null);
    if (activeTab === 'map') {
      fetchMapPins(); // Fetch all pins
    } else {
      setAppliedCategories([]);
      setSelectedCategories([]);
      fetchPosts(true, []);
    }
  } else {
    // Select and search
    setSelectedQuickCategory(category.id);
    if (activeTab === 'map') {
      fetchMapPins(category.name); // Search by category name
    } else {
      setAppliedCategories([category.name]);
      setSelectedCategories([category.name]);
      fetchPosts(true, [category.name]);
    }
  }
};

  const handleRestaurantPress = (restaurant: any) => {
    setSelectedRestaurant(restaurant);
    setShowRestaurantModal(true);
  };

  const handlePostPress = (post: any) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleViewRestaurantProfile = (restaurant: any) => {
    setShowRestaurantModal(false);
    router.push(`/restaurant/${restaurant.id}`);
  };

  const handleViewPost = (post: any) => {
    setShowPostModal(false);
    router.push(`/post-details/${post.id}`);
  };

  // ======================================================
  // INITIALIZE MAP WHEN TAB CHANGES
  // ======================================================

  useEffect(() => {
    if (activeTab === 'map' && !userLocation) {
      getCurrentLocation().then((coords) => {
        if (coords) {
          fetchMapPins();
        }
      });
    }
  }, [activeTab]);

  useEffect(() => {
    if (userLocation && activeTab === 'map') {
      fetchMapPins();
    }
  }, [userLocation]);

  // ======================================================
  // EXISTING FEED LOGIC (for USERS tab)
  // ======================================================

  const handleVideoLayout = useCallback((videoId: string, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    videoPositions.current.set(videoId, { top: y, height });
  }, []);

  const calculateVisibleVideos = useCallback((currentScrollY: number) => {
    const visibleTop = currentScrollY;
    const visibleBottom = currentScrollY + SCREEN_HEIGHT;
    const visible: string[] = [];
    posts.forEach((post) => {
      if (!post._isVideo) return;
      const position = videoPositions.current.get(post.id);
      if (!position) return;
      if (position.top + position.height > visibleTop && position.top < visibleBottom - 100) {
        visible.push(post.id);
      }
    });
    setPlayingVideos(visible.slice(0, MAX_CONCURRENT_VIDEOS));
  }, [posts]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    setScrollY(contentOffset.y);
    calculateVisibleVideos(contentOffset.y);
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
      if (hasMore && !loadingMore && !loading) fetchPosts(false);
    }
  }, [calculateVisibleVideos, hasMore, loadingMore, loading]);

  useEffect(() => {
    if (posts.length > 0) {
      const timer = setTimeout(() => calculateVisibleVideos(scrollY), 500);
      return () => clearTimeout(timer);
    }
  }, [posts, calculateVisibleVideos, scrollY]);

  useFocusEffect(useCallback(() => {
  // Only fetch if no posts AND on users tab
  if (user && token && activeTab === 'users' && posts.length === 0) {
    fetchPosts(true);
  }
  return () => setPlayingVideos([]);
}, [user, token, activeTab]));

// Initial load - fetch posts once when component mounts
useEffect(() => {
  if (user && token && posts.length === 0) {
    fetchPosts(true);
  }
}, [user, token]);

  const fetchPosts = async (refresh = false, categories?: string[], tab?: 'map' | 'users') => {
    try {
      if (refresh) { setLoading(true); setPage(1); setHasMore(true); videoPositions.current.clear(); }
      else { if (!hasMore || loadingMore) return; setLoadingMore(true); }
      const categoriesToUse = categories ?? appliedCategories;
      const currentTab = tab ?? activeTab;
      const skip = refresh ? 0 : (page - 1) * POSTS_PER_PAGE;
      
      // For USERS tab, fetch user posts only
      let feedUrl = `${API_URL}/feed?skip=${skip}&limit=${POSTS_PER_PAGE}`;
      
      if (categoriesToUse.length > 0) {
        feedUrl += `&categories=${encodeURIComponent(categoriesToUse.join(","))}`;
      }
      
      const res = await axios.get(feedUrl, { headers: { Authorization: `Bearer ${token || ""}` } });
      
      let postsData = res.data;
      
      if (postsData.length === 0) { 
        setHasMore(false); 
        if (refresh) setPosts([]); 
        return; 
      }
      
      const newPosts = postsData.map((post: any) => {
        const fullUrl = fixUrl(post.media_url || post.image_url);
        return { 
          ...post, 
          full_image_url: fullUrl, 
          full_thumbnail_url: fixUrl(post.thumbnail_url), 
          is_liked: post.is_liked_by_user || false, 
          _isVideo: isVideoFile(fullUrl || "", post.media_type), 
          category: post.category?.trim() || null, 
          aspect_ratio: post.aspect_ratio || null 
        };
      });
      
      if (refresh) { 
        setPosts(newPosts); 
        setPage(2); 
      } else { 
        setPosts((p) => [...p, ...newPosts.filter((np: any) => !p.some((ep) => ep.id === np.id))]); 
        setPage((prev) => prev + 1); 
      }
      
      if (newPosts.length < POSTS_PER_PAGE) setHasMore(false);
    } catch (err) { 
      console.error("Fetch error:", err); 
    } finally { 
      setLoading(false); 
      setLoadingMore(false); 
      setRefreshing(false); 
    }
  };

  const fetchPostsWithCategories = (categories: string[]) => fetchPosts(true, categories);
  const performSearch = () => { if (searchQuery.trim()) router.push({ pathname: "/search-results", params: { query: searchQuery.trim() } }); };
  const toggleCategory = (item: string) => { if (item === "All") setSelectedCategories([]); else setSelectedCategories((prev) => prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]); };
  const handleLike = async (id: string, liked: boolean) => { setPosts((prev) => prev.map((p) => p.id === id ? { ...p, is_liked: !liked, likes_count: p.likes_count + (liked ? -1 : 1) } : p)); try { liked ? await unlikePost(id) : await likePost(id); } catch (err) { console.log("Like error:", err); } };
  const onRefresh = useCallback(() => { setRefreshing(true); setPlayingVideos([]); fetchPosts(true); }, [appliedCategories]);
  const handlePostPressGrid = (postId: string) => { setPlayingVideos([]); router.push(`/post-details/${postId}`); };

  if (!user || !token) return <View style={styles.center}><ActivityIndicator size="large" color="#4dd0e1" /><Text>Authenticating…</Text></View>;

  const columns = distributePosts(posts);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <LinearGradient colors={["#E94A37", "#F2CF68", "#1B7C82"]} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientHeader}>
          <Text style={styles.headerTitle}>Cofau</Text>
        </LinearGradient>
        
        {/* Only show search box for USERS tab */}
          <View style={styles.searchBoxWrapper}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
              <TextInput style={styles.searchInput} placeholder="Search" placeholderTextColor="#999" value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search" onSubmitEditing={() => {
  if (activeTab === 'map') {
    handleMapSearch(searchQuery);
  } else {
    performSearch();
  }
}} />
              <TouchableOpacity onPress={() => setShowCategoryModal(true)} activeOpacity={0.8}>
  <LinearGradient 
    colors={["#E94A37", "#F2CF68", "#1B7C82"]} 
    start={{ x: 0, y: 0 }} 
    end={{ x: 1, y: 0 }} 
    style={styles.categoryButtonGradient}
  >
    <Ionicons name="options-outline" size={18} color="#FFF" />
    <Text style={styles.categoryButtonText}>
      {appliedCategories.length > 0 ? `${appliedCategories.length} selected` : "Category"}
    </Text>
  </LinearGradient>
</TouchableOpacity>
            </View>
          </View>
      </View>


{/* QUICK CATEGORY CHIPS */}
<ScrollView 
  horizontal 
  showsHorizontalScrollIndicator={false} 
  style={styles.quickCategoryScroll}
  contentContainerStyle={styles.quickCategoryContainer}
>
  {QUICK_CATEGORIES.map((category) => (
    <TouchableOpacity
      key={category.id}
      style={[
        styles.quickCategoryChip,
        selectedQuickCategory === category.id && styles.quickCategoryChipActive
      ]}
      onPress={() => handleQuickCategoryPress(category)}
      activeOpacity={0.7}
    >
      <Text style={styles.quickCategoryEmoji}>{category.emoji}</Text>
      <Text style={[
        styles.quickCategoryText,
        selectedQuickCategory === category.id && styles.quickCategoryTextActive
      ]}>
        {category.name}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

      {/* MAP | USERS TOGGLE */}
<View style={styles.toggleContainer}>
  <View style={styles.toggleBackground}>
    <TouchableOpacity 
      style={[styles.toggleTab, activeTab === 'map' && styles.toggleTabActive]}
      onPress={() => {
        if (activeTab !== 'map') {
          setActiveTab('map');
          setPlayingVideos([]);
        }
      }}
    >
      <Ionicons 
        name="location" 
        size={16} 
        color={activeTab === 'map' ? '#E94A37' : '#999'} 
        style={{ marginRight: 6 }} 
      />
      <Text style={[styles.toggleTabText, activeTab === 'map' && styles.toggleTabTextActive]}>
        Map
      </Text>
    </TouchableOpacity>

    <TouchableOpacity 
  style={[styles.toggleTab, activeTab === 'users' && styles.toggleTabActive]}
  onPress={() => {
    if (activeTab !== 'users') {
      setActiveTab('users');
      // Only fetch if no posts cached
      if (posts.length === 0) {
        setLoading(true);
        fetchPosts(true, [], 'users');
      }
    }
  }}
>
      <Ionicons 
        name="person" 
        size={16} 
        color={activeTab === 'users' ? '#E94A37' : '#999'} 
        style={{ marginRight: 6 }} 
      />
      <Text style={[styles.toggleTabText, activeTab === 'users' && styles.toggleTabTextActive]}>
        Users
      </Text>
    </TouchableOpacity>
  </View>
</View>

      {/* USERS TAB: Category Tags */}
      {activeTab === 'users' && appliedCategories.length > 0 && (
        <View style={styles.selectedTagsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedTagsContainer}>
            {appliedCategories.map((cat) => (
              <TouchableOpacity key={cat} style={styles.selectedTag} onPress={() => { const nc = appliedCategories.filter((c) => c !== cat); setAppliedCategories(nc); setSelectedCategories(nc); fetchPostsWithCategories(nc); }}>
                <Text style={styles.selectedTagText}>{cat}</Text><Ionicons name="close-circle" size={16} color="#666" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
  style={styles.clearAllButton} 
  onPress={() => { 
    setSelectedCategories([]); 
    setAppliedCategories([]); 
    setSelectedQuickCategory(null); // Add this line
    if (activeTab === 'map') {
      fetchMapPins();
    } else {
      fetchPostsWithCategories([]); 
    }
  }}
>
  <Text style={styles.clearAllText}>Clear All</Text>
</TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* CONTENT AREA */}
      {activeTab === 'map' ? (
        // MAP VIEW
        <MapViewComponent
          userLocation={userLocation}
          restaurants={mapRestaurants}
          posts={mapPosts}
          onRestaurantPress={handleRestaurantPress}
          onPostPress={handlePostPress}
          searchQuery={mapSearchQuery}
          onSearch={handleMapSearch}
          isLoading={mapLoading}
          mapRef={mapRef}
        />
      ) : (
        // USERS GRID VIEW
        <>
          {loading && posts.length === 0 ? (
            <View style={styles.center}><ActivityIndicator size="large" color="#4dd0e1" /><Text>Loading posts…</Text></View>
          ) : (
            <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4dd0e1" />}>
              <View style={styles.masonryContainer}>
                {columns.map((column, columnIndex) => (
                  <View key={columnIndex} style={styles.column}>
                    {column.map((item) => <GridTile key={item.id} item={item} onPress={handlePostPressGrid} onLike={handleLike} onVideoLayout={handleVideoLayout} playingVideos={playingVideos} />)}
                  </View>
                ))}
              </View>
              {loadingMore && <View style={styles.loadingMore}><ActivityIndicator size="small" color="#4dd0e1" /></View>}
              {!loading && posts.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="images-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyStateText}>
                    {appliedCategories.length > 0 
                      ? `No posts found for selected ${appliedCategories.length === 1 ? 'category' : 'categories'}` 
                      : 'No posts found'}
                  </Text>
                  {appliedCategories.length > 0 && (
                    <TouchableOpacity 
                      style={{ marginTop: 12 }} 
                      onPress={() => { 
                        setSelectedCategories([]); 
                        setAppliedCategories([]); 
                        fetchPosts(true, [], 'users'); 
                      }}
                    >
                      <Text style={{ color: '#E94A37', fontWeight: '600' }}>Clear Filters</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={{ height: 120 }} />
            </ScrollView>
          )}
        </>
      )}

      {/* BOTTOM NAVIGATION */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/feed")}><Ionicons name="home-outline" size={20} color="#000" /><Text style={styles.navLabel}>Home</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/explore")}><Ionicons name="compass" size={20} color="#000" /><Text style={styles.navLabelActive}>Explore</Text></TouchableOpacity>
        <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push("/leaderboard")}><View style={styles.centerIconCircle}><Ionicons name="camera" size={22} color="#000" /></View><Text style={styles.navLabel}>Top Posts</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/happening")}><Ionicons name="location-outline" size={20} color="#000" /><Text style={styles.navLabel}>Happening</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/profile")}><Ionicons name="person-outline" size={20} color="#000" /><Text style={styles.navLabel}>Profile</Text></TouchableOpacity>
      </View>

      {/* CATEGORY MODAL */}
      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => { setSelectedCategories(appliedCategories); setShowCategoryModal(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => { setSelectedCategories(appliedCategories); setShowCategoryModal(false); }}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            {selectedCategories.length > 0 && <View style={styles.selectedCountContainer}><Text style={styles.selectedCountText}>{selectedCategories.length} categories selected</Text><TouchableOpacity onPress={() => setSelectedCategories([])}><Text style={styles.clearAllModalText}>Clear All</Text></TouchableOpacity></View>}
            <FlatList data={CATEGORIES} keyExtractor={(item) => item} renderItem={({ item }) => {
              const isSelected = item === "All" ? selectedCategories.length === 0 : selectedCategories.includes(item);
              return (
                <TouchableOpacity style={[styles.categoryItem, isSelected && styles.categoryItemSelected]} onPress={() => { if (item === "All") { setSelectedCategories([]); setShowCategoryModal(false); setAppliedCategories([]); fetchPostsWithCategories([]); } else toggleCategory(item); }}>
                  <View style={styles.categoryItemContent}><Ionicons name={getCategoryIcon(item)} size={24} color={isSelected ? "#fff" : "#666"} /><Text style={[styles.categoryItemText, isSelected && styles.categoryItemTextSelected]}>{item}</Text></View>
                  {isSelected ? <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" /> : <Ionicons name="ellipse-outline" size={24} color="#CCC" />}
                </TouchableOpacity>
              );
            }} contentContainerStyle={styles.categoryList} />
            <View style={styles.modalFooter}>
             <TouchableOpacity 
  style={styles.doneButton} 
  onPress={() => { 
    setAppliedCategories(selectedCategories); 
    setShowCategoryModal(false); 
    
    if (activeTab === 'map') {
      // For map tab - search with selected categories
      if (selectedCategories.length > 0) {
        fetchMapPins(selectedCategories.join(' '));
      } else {
        fetchMapPins();
      }
    } else {
      // For users tab - existing logic
      setPosts([]); 
      setPage(1); 
      setHasMore(true); 
      setPlayingVideos([]); 
      fetchPostsWithCategories(selectedCategories); 
    }
    
    // Clear quick category selection when using modal
    setSelectedQuickCategory(null);
  }}
>
  <Text style={styles.doneButtonText}>
    Apply Filters {selectedCategories.length > 0 ? `(${selectedCategories.length})` : ""}
  </Text>
</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RESTAURANT DETAIL MODAL */}
      <RestaurantDetailModal
        visible={showRestaurantModal}
        restaurant={selectedRestaurant}
        onClose={() => setShowRestaurantModal(false)}
        onViewProfile={handleViewRestaurantProfile}
      />

      {/* POST DETAIL MODAL */}
      <PostDetailModal
        visible={showPostModal}
        post={selectedPost}
        onClose={() => setShowPostModal(false)}
        onViewPost={handleViewPost}
      />
    </View>
  );
}

function getCategoryIcon(category: string): any {
  const icons: { [key: string]: string } = { All: "grid-outline", "Vegetarian/Vegan": "leaf-outline", "Non vegetarian": "restaurant-outline", Biryani: "restaurant", SeaFood: "fish-outline", Chinese: "restaurant-outline", Chats: "cafe-outline", Desserts: "ice-cream-outline", Arabic: "restaurant-outline", "BBQ/Tandoor": "flame-outline", "Fast Food": "fast-food-outline", "Tea/Coffee": "cafe-outline", Salad: "nutrition-outline", Continental: "globe-outline", Italian: "pizza-outline", "Drinks / sodas": "wine-outline" };
  return icons[category] || "location-outline";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  headerContainer: { position: "relative", marginBottom: 30, zIndex: 10 },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  tabContainerMap: {
    marginTop: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#F2CF68',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  activeTabText: {
    color: '#000',
  },
  gradientHeader: { paddingTop: 65, paddingBottom: 55, alignItems: "center", justifyContent: "center", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  headerTitle: { fontFamily: "Lobster", fontSize: 32, color: "#fff", textAlign: "center", letterSpacing: 1 },
  searchBoxWrapper: { position: "absolute", bottom: -25, left: 16, right: 16, zIndex: 10 },
  searchBox: { backgroundColor: "#fff", borderRadius: 25, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 12 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: "#333" },
  inlineFilterButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#1B7C82", borderRadius: 18, paddingVertical: 5, paddingHorizontal: 12, gap: 4 },
  gradientBorder: { borderRadius: 20, padding: 2 },
  inlineFilterText: { fontSize: 12, color: "#FFF", fontWeight: "600", maxWidth: 70 },
  selectedTagsWrapper: { paddingHorizontal: 16, marginBottom: 10 },
  selectedTagsContainer: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  selectedTag: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5E6", borderRadius: 16, paddingVertical: 6, paddingLeft: 12, paddingRight: 8, gap: 4, borderWidth: 1, borderColor: "#F2CF68" },
  selectedTagText: { fontSize: 12, color: "#333", fontWeight: "500" },
  clearAllButton: { paddingVertical: 6, paddingHorizontal: 12 },
  clearAllText: { fontSize: 12, color: "#E94A37", fontWeight: "600" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING },
  masonryContainer: { flexDirection: "row", justifyContent: "space-between" },
  column: { width: COLUMN_WIDTH, gap: SPACING },
  tile: { width: "100%", borderRadius: 8, overflow: "hidden", backgroundColor: "#1a1a1a", position: "relative", marginBottom: SPACING },
  tileImage: { width: "100%", height: "100%" },
  tileVideo: { width: "100%", height: "100%" },
  thumbnailOverlay: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  placeholderImage: { backgroundColor: "#2a2a2a", justifyContent: "center", alignItems: "center" },
  playIconContainer: { position: "absolute", top: "50%", left: "50%", transform: [{ translateX: -20 }, { translateY: -20 }], width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  likeBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", padding: 8, borderRadius: 20 },
  viewsContainer: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  viewsText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  loadingMore: { padding: 20, alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  emptyStateText: { fontSize: 18, fontWeight: "600", color: "#333", marginTop: 16 },
  navBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#E8E8E8", backgroundColor: "#FFFFFF", elevation: 8 },
  navItem: { alignItems: "center", justifyContent: "center", paddingVertical: 4, paddingHorizontal: 12 },
  navLabel: { fontSize: 11, color: "#000", marginTop: 2, textAlign: "center", fontWeight: "500" },
  navLabelActive: { fontSize: 11, color: "#000", marginTop: 0, textAlign: "center", fontWeight: "700" },
  centerNavItem: { alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 12, marginTop: -30 },
  centerIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff", borderWidth: 2, borderColor: "#333", justifyContent: "center", alignItems: "center", marginBottom: 4, elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: "flex-end" },
  categoryModal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  categoryModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#E5E5E5" },
  categoryModalTitle: { fontSize: 20, fontWeight: "bold", color: "#000" },
  selectedCountContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#F0F9F9" },
  selectedCountText: { fontSize: 14, color: "#4ECDC4", fontWeight: "600" },
  clearAllModalText: { fontSize: 14, color: "#E94A37", fontWeight: "600" },
  categoryList: { padding: 12 },
  categoryItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: "#F9F9F9" },
  categoryItemSelected: { backgroundColor: "#1B7C82", borderWidth: 2, borderColor: "#4ECDC4" },
  categoryItemContent: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  categoryItemText: { fontSize: 16, color: "#000", flex: 1 },
  categoryItemTextSelected: { fontWeight: "600", color: "#fff" },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#E5E5E5" },
  doneButton: { backgroundColor: "#4ECDC4", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  doneButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },

  // ======================================================
  // MAP STYLES
  // ======================================================
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapSearchContainer: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  mapSearchBox: {
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
  },
  clearSearchBtn: {
    padding: 4,
    marginRight: 8,
  },
  mapSearchBtn: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  mapSearchBtnGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  mapSearchBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  resultsCountContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  resultsCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // ======================================================
  // RESTAURANT MARKER STYLES
  // ======================================================
  restaurantMarkerContainer: {
    alignItems: 'center',
  },
  restaurantMarkerBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E94A37',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  restaurantMarkerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  restaurantMarkerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E94A37',
  },
  reviewBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#1B7C82',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  reviewBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -2,
  },
  categoryButtonGradient: {
  flexDirection: 'row',
  alignItems: 'center',
  borderRadius: 20,
  paddingVertical: 8,
  paddingHorizontal: 14,
  gap: 6,
},
categoryButtonText: {
  fontSize: 12,
  color: '#FFF',
  fontWeight: '600',
  maxWidth: 80,
},

  // ======================================================
  // POST MARKER STYLES
  // ======================================================
  postMarkerContainer: {
    alignItems: 'center',
  },
  postMarkerBubble: {
    width: 65,
    height: 65,
    borderRadius: 8,
    backgroundColor: '#F2CF68',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  postMarkerImage: {
    width: '120%',
    height: '120%',
    borderRadius: 6,
  },
  postMarkerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2CF68',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#E94A37',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  ratingBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  postMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -1,
  },

  // ======================================================
// SEARCH BAR STYLES (Outside Map)
// ======================================================
searchBarContainer: {
  paddingHorizontal: 16,
  marginTop: -20,
  marginBottom: 12,
  zIndex: 20,
},
searchBarBox: {
  backgroundColor: '#fff',
  borderRadius: 25,
  paddingHorizontal: 16,
  paddingVertical: 10,
  flexDirection: 'row',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
},
searchBarInput: {
  flex: 1,
  fontSize: 15,
  color: '#333',
  paddingVertical: 2,
},
searchBarBtn: {
  borderRadius: 20,
  overflow: 'hidden',
  marginLeft: 8,
},
searchBarBtnGradient: {
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 20,
},
searchBarBtnText: {
  color: '#fff',
  fontSize: 14,
  fontWeight: '600',
},

// ======================================================
// QUICK CATEGORY CHIPS STYLES
// ======================================================
quickCategoryScroll: {
  maxHeight: 50,
  marginBottom: 12,
},
quickCategoryContainer: {
  paddingHorizontal: 16,
  gap: 10,
  flexDirection: 'row',
  alignItems: 'center',
},
quickCategoryChip: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFF8F0',
  borderRadius: 20,
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: '#F2CF68',
},
quickCategoryChipActive: {
  backgroundColor: '#E94A37',
  borderColor: '#E94A37',
},
quickCategoryEmoji: {
  fontSize: 18,
  marginRight: 6,
},
quickCategoryText: {
  fontSize: 13,
  fontWeight: '500',
  color: '#333',
},
quickCategoryTextActive: {
  color: '#fff',
},

// ======================================================
// TOGGLE TABS STYLES (Pill Style)
// ======================================================
toggleContainer: {
  alignItems: 'center',
  marginBottom: 12,
  paddingHorizontal: 16,
},
toggleBackground: {
  flexDirection: 'row',
  backgroundColor: '#F5F5F5',
  borderRadius: 25,
  padding: 4,
},
toggleTab: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 10,
  paddingHorizontal: 24,
  borderRadius: 22,
},
toggleTabActive: {
  backgroundColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},
toggleTabText: {
  fontSize: 14,
  fontWeight: '500',
  color: '#999',
},
toggleTabTextActive: {
  color: '#E94A37',
  fontWeight: '600',
},

  // ======================================================
  // DETAIL MODAL STYLES
  // ======================================================
  detailModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  restaurantDetailHeader: {
    flexDirection: 'row',
    marginTop: 10,
  },
  restaurantDetailImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
  },
  restaurantDetailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E94A37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantDetailInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  restaurantDetailName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4ECDC4',
    marginLeft: 4,
  },
  restaurantDetailBio: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  restaurantStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  viewProfileBtn: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewProfileBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  viewProfileBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // ======================================================
  // POST DETAIL MODAL STYLES
  // ======================================================
  postDetailContent: {
    marginTop: 10,
  },
  postDetailImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  postDetailInfo: {
    marginTop: 16,
  },
  postUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
  },
  postUserAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1B7C82',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 10,
  },
  postLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  postLocationText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  postCategoryBadge: {
    backgroundColor: '#FFF5E6',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F2CF68',
  },
  postCategoryText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  postReviewText: {
    fontSize: 14,
    color: '#333',
    marginTop: 12,
    lineHeight: 20,
  },
  postStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 20,
  },
  postStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
});