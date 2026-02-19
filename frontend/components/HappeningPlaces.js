import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  TextInput,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SalesDashboard } from './SalesDashboard';

export const options = {
  headerShown: false,
};

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAX_CONCURRENT_VIDEOS = 3;


// Check if URL is a video file
const isVideoFile = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('.mp4') ||
    lower.includes('.mov') ||
    lower.includes('.mkv') ||
    lower.includes('.webm')
  );
};

// Skeleton Loading Component
const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonHeader}>
      <View style={styles.skeletonRank} />
      <View style={styles.skeletonTitleContainer}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSubtitle} />
      </View>
    </View>
    <View style={styles.skeletonImageRow}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonImage} />
    </View>
    <View style={styles.skeletonImageRow}>
      <View style={styles.skeletonImageLarge} />
      <View style={styles.skeletonImageLarge} />
    </View>
  </View>
);

const SkeletonLoader = () => (
  <View style={styles.skeletonContainer}>
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
  </View>
);

// Video Thumbnail Component with autoplay - lazy loads video only when needed
const VideoThumbnail = memo(({ videoUrl, thumbnailUrl, style, shouldPlay, onLayout, videoId }) => {
  const videoRef = useRef(null);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  // Only mount the Video component once shouldPlay becomes true
  useEffect(() => {
    if (shouldPlay && !hasBeenVisible) {
      setHasBeenVisible(true);
    }
  }, [shouldPlay, hasBeenVisible]);

  useEffect(() => {
    const controlVideo = async () => {
      if (!videoRef.current) return;
      try {
        if (shouldPlay) {
          const status = await videoRef.current.getStatusAsync();
          if (!status.isLoaded) {
            await videoRef.current.loadAsync(
              { uri: videoUrl },
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
    if (hasBeenVisible) {
      controlVideo();
    }
  }, [shouldPlay, videoUrl, hasBeenVisible]);

  return (
    <View style={style} onLayout={(e) => onLayout && onLayout(videoId, e)}>
      {/* Only mount Video component after it should play at least once */}
      {hasBeenVisible && (
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted={true}
          useNativeControls={false}
          shouldPlay={false}
          posterSource={{ uri: thumbnailUrl }}
          usePoster={true}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded) setIsActuallyPlaying(status.isPlaying);
          }}
        />
      )}

      {/* Thumbnail - show when video is not playing (or not yet loaded) */}
      {!isActuallyPlaying && thumbnailUrl && (
        <Image
          source={{ uri: thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          placeholder={{ blurhash: BLUR_HASH }}
        />
      )}

      {/* Play icon - hide when playing */}
      {!isActuallyPlaying && (
        <View style={styles.videoPlayIcon}>
          <Ionicons name="play-circle" size={22} color="#fff" />
        </View>
      )}
    </View>
  );
});

export default function HappeningPlaces() {
  const router = useRouter();
  const { token, accountType } = useAuth();
  const isRestaurant = accountType === 'restaurant';
  
  // ============================================
  // STATE DECLARATIONS
  // ============================================
  const [topLocations, setTopLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFixedLine, setShowFixedLine] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [visibleCards, setVisibleCards] = useState(3); // Initially show 3 cards

  // Dropdown state for "SELECT YOUR FOOD SPOT"
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState('All'); // 'All' or an area object
  const [nearbyAreas, setNearbyAreas] = useState([]); // Real area/locality names
  const [areasLoading, setAreasLoading] = useState(false);
  const [areaPosts, setAreaPosts] = useState([]); // Posts for selected area
  const [areaPostsLoading, setAreaPostsLoading] = useState(false);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [areaSearchResults, setAreaSearchResults] = useState([]);
  const [areaSearching, setAreaSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const searchTimerRef = useRef(null);

  // Track if initial load has happened to prevent duplicate fetch
  const hasInitiallyLoaded = useRef(false);

  // Video autoplay state
  const videoPositions = useRef(new Map());
  const [scrollY, setScrollY] = useState(0);
  const [playingVideos, setPlayingVideos] = useState([]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const fixUrl = (url, { thumbnail = false } = {}) => {
    if (!url) return null;
    let fullUrl;
    if (url.startsWith('http')) {
      fullUrl = url;
    } else {
      const cleanUrl = url.startsWith('/') ? url : `/${url}`;
      fullUrl = `${API_BASE_URL}${cleanUrl}`;
    }
    // Append ?w=300 for grid thumbnails to load smaller images
    if (thumbnail && !isVideoFile(url)) {
      const separator = fullUrl.includes('?') ? '&' : '?';
      return `${fullUrl}${separator}w=300`;
    }
    return fullUrl;
  };

  const formatUploadCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // ============================================
  // LOCATION FUNCTIONS
  // ============================================

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission required to see nearby places");
        return false;
      }
      return true;
    } catch (error) {
      console.log("Location permission error:", error);
      setLocationError("Could not get location permission");
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return null;

      // On Android, try last known position first for instant result
      if (Platform.OS === 'android') {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            const coords = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
            setUserLocation(coords);
            setLocationError(null);
            return coords;
          }
        } catch (e) {
          console.log("Last known position unavailable:", e);
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'android' ? Location.Accuracy.Low : Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);
      setLocationError(null);
      return coords;
    } catch (error) {
      console.log("Get location error:", error);
      setLocationError("Could not get your location");
      return null;
    }
  };

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchTopLocations = async (coords) => {
  if (!token) {
    console.warn('⚠️ No token available for fetching locations');
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    videoPositions.current.clear();
    
    let endpoint;
    
    if (coords || userLocation) {
      const location = coords || userLocation;
      endpoint = `${API_URL}/locations/nearby?lat=${location.latitude}&lng=${location.longitude}&radius_km=50&limit=20`;
      console.log('🔍 Fetching nearby locations from:', endpoint);
    } else {
      endpoint = `${API_URL}/locations/top`;
      console.log('🔍 Fetching top locations (no location) from:', endpoint);
    }

    const response = await axios.get(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const locations = Array.isArray(response.data) ? response.data : [];
    setTopLocations(locations);
    console.log(`✅ Loaded ${locations.length} locations`);
  } catch (error) {
    console.error('❌ Error fetching locations:', error.response?.data || error.message);
    setTopLocations([]);
  } finally {
    setLoading(false);
  }
};

  // ============================================
  // VIDEO FUNCTIONS
  // ============================================

  const handleVideoLayout = useCallback((videoId, event) => {
    const { y, height } = event.nativeEvent.layout;
    videoPositions.current.set(videoId, { top: y, height });
  }, []);

  const calculateVisibleVideos = useCallback((currentScrollY) => {
    const visibleTop = currentScrollY;
    const visibleBottom = currentScrollY + SCREEN_HEIGHT;
    const visible = [];

    videoPositions.current.forEach((position, videoId) => {
      if (position.top + position.height > visibleTop && position.top < visibleBottom - 100) {
        visible.push(videoId);
      }
    });

    setPlayingVideos(visible.slice(0, MAX_CONCURRENT_VIDEOS));
  }, []);

  const handleScroll = useCallback((event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    setScrollY(currentScrollY);
    calculateVisibleVideos(currentScrollY);

    if (currentScrollY > 100) {
      setShowFixedLine(true);
    } else {
      setShowFixedLine(false);
    }
  }, [calculateVisibleVideos]);

  // Fetch nearby area/locality names from Google Places
  const fetchNearbyAreas = async (coords) => {
    if (!token || !coords) return;
    try {
      setAreasLoading(true);
      const response = await axios.get(
        `${API_URL}/places/nearby-areas?latitude=${coords.latitude}&longitude=${coords.longitude}&radius_km=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.success) {
        setNearbyAreas(response.data.areas || []);
      }
    } catch (error) {
      console.error('❌ Error fetching nearby areas:', error.message);
    } finally {
      setAreasLoading(false);
    }
  };

  // Fetch posts within a selected area's radius
  const fetchAreaPosts = async (area) => {
    if (!token || !area?.latitude || !area?.longitude) {
      setAreaPosts([]);
      return;
    }
    try {
      setAreaPostsLoading(true);
      const response = await axios.get(
        `${API_URL}/places/area-posts?area_name=${encodeURIComponent(area.name)}&latitude=${area.latitude}&longitude=${area.longitude}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAreaPosts(response.data?.posts || []);
    } catch (error) {
      console.error('❌ Error fetching area posts:', error.message);
      setAreaPosts([]);
    } finally {
      setAreaPostsLoading(false);
    }
  };

  const handleAreaSelect = (area) => {
    setSelectedArea(area);
    setDropdownOpen(false);
    setAreaSearchQuery('');
    setAreaSearchResults([]);
    if (area === 'All') {
      setAreaPosts([]);
    } else {
      fetchAreaPosts(area);
      saveRecentSearch(area);
    }
  };

  // Debounced search for areas within 50km
  const searchAreas = (text) => {
    setAreaSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text || text.length < 2) {
      setAreaSearchResults([]);
      setAreaSearching(false);
      return;
    }
    setAreaSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const coords = userLocation;
        if (!coords || !token) return;
        const response = await axios.get(
          `${API_URL}/places/search-areas?query=${encodeURIComponent(text)}&latitude=${coords.latitude}&longitude=${coords.longitude}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data?.success) {
          setAreaSearchResults(response.data.areas || []);
        }
      } catch (err) {
        console.error('Area search error:', err.message);
      } finally {
        setAreaSearching(false);
      }
    }, 400);
  };

  // Recent searches - load from AsyncStorage
  const RECENT_SEARCHES_KEY = 'happeningplaces_recent_searches';
  const MAX_RECENT_SEARCHES = 8;

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.log('Error loading recent searches:', e);
    }
  };

  const saveRecentSearch = async (area) => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      let searches = stored ? JSON.parse(stored) : [];
      // Remove duplicate if exists
      searches = searches.filter((s) => s.name !== area.name);
      // Add to front
      searches.unshift({ name: area.name, latitude: area.latitude, longitude: area.longitude, distance_km: area.distance_km });
      // Limit
      searches = searches.slice(0, MAX_RECENT_SEARCHES);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
      setRecentSearches(searches);
    } catch (e) {
      console.log('Error saving recent search:', e);
    }
  };

  const clearRecentSearches = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch (e) {
      console.log('Error clearing recent searches:', e);
    }
  };

  const handleLocationPress = (location) => {
    setPlayingVideos([]);
    const locationName = location.location || location.location_name;
    if (locationName) {
      router.push({
        pathname: '/location-details',
        params: { locationName: encodeURIComponent(locationName) },
      });
    }
  };

  // ============================================
  // RENDER MEDIA HELPER
  // ============================================

  const formatCount = (count) => {
    if (!count) return '0';
    return count > 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
  };

  const renderMediaItem = (imageUrl, imgIndex, imagesData, thumbnails, locationKey) => {
    const fixedUrl = fixUrl(imageUrl, { thumbnail: true });
    const imageData = imagesData[imgIndex] || {};
    const thumbnailUrl = imageData.thumbnail_url
      ? fixUrl(imageData.thumbnail_url)
      : (thumbnails[imgIndex] ? fixUrl(thumbnails[imgIndex]) : null);
    const isVideo = isVideoFile(imageUrl) || imageData.media_type === 'video';
    const dishName = imageData.dish_name;
    const clicksCount = imageData.clicks_count || 0;
    const viewsCount = imageData.views_count || 0;

    const videoId = `${locationKey}-${imgIndex}`;

    // Overlay badges for dish name and clicks
    const overlayBadges = (
      <>
        {(clicksCount > 0 || viewsCount > 0) && (
          <View style={styles.gridClicksBadge}>
            <Ionicons name="eye-outline" size={9} color="#fff" />
            <Text style={styles.gridClicksText}>{formatCount(viewsCount || clicksCount)}</Text>
          </View>
        )}
        {dishName && (
          <View style={styles.gridDishTag}>
            <Text style={styles.gridDishText} numberOfLines={1}>{dishName}</Text>
          </View>
        )}
      </>
    );

    if (isVideo) {
      if (!fixedUrl) return null;
      return (
        <View key={imgIndex} style={styles.gridImageContainer}>
          <VideoThumbnail
            videoId={videoId}
            videoUrl={fixedUrl}
            thumbnailUrl={thumbnailUrl}
            style={StyleSheet.absoluteFill}
            shouldPlay={playingVideos.includes(videoId)}
            onLayout={(id, e) => {
              e.target.measureInWindow((x, y, width, height) => {
                videoPositions.current.set(id, { top: y, height });
              });
            }}
          />
          {overlayBadges}
        </View>
      );
    } else {
      if (!fixedUrl) return null;
      return (
        <View key={imgIndex} style={styles.gridImageContainer}>
          <Image
            source={{ uri: fixedUrl }}
            style={styles.gridImageSquare}
            contentFit="cover"
            placeholder={{ blurhash: BLUR_HASH }}
            transition={300}
            cachePolicy="disk"
            onError={(error) => {
              console.error("❌ Image load error in HappeningPlaces:", fixedUrl, error);
            }}
          />
          {overlayBadges}
        </View>
      );
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  useFocusEffect(
    React.useCallback(() => {
      if (token) {
        if (hasInitiallyLoaded.current) {
          // Subsequent focus: use cached location, skip GPS wait
          console.log('🔄 HappeningPlaces screen focused - refreshing locations');
          if (userLocation) {
            fetchTopLocations(userLocation);
          } else {
            fetchTopLocations();
          }
        } else {
          // First load: get location then fetch + fetch nearby areas
          hasInitiallyLoaded.current = true;
          getCurrentLocation().then((coords) => {
            if (coords) {
              fetchTopLocations(coords);
              fetchNearbyAreas(coords);
            } else {
              fetchTopLocations();
            }
          });
        }
      }
      return () => {
        setPlayingVideos([]);
      };
    }, [token, userLocation])
  );

  useEffect(() => {
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (topLocations.length > 0) {
      const timer = setTimeout(() => calculateVisibleVideos(scrollY), 300);
      return () => clearTimeout(timer);
    }
  }, [scrollY, topLocations, calculateVisibleVideos]);

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <LinearGradient
                colors={["#FFF5F0", "#FFE5D9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientHeader}
              >
              </LinearGradient>
            </View>
            
            {/* Title Box */}
            <View style={styles.titleBoxWrapper}>
              <BlurView intensity={60} tint="light" style={styles.titleBox}>
                <Text style={[styles.titleMain, isRestaurant && styles.titleMainLarge]}>
                  {isRestaurant ? 'Sales Dashboard' : 'Happening places'}
                </Text>
                {!isRestaurant && (
                  <View style={styles.subtitleRow}>
                    <Ionicons
                      name="location"
                      size={16}
                      color="#E94A37"
                    />
                    <Text style={styles.titleSub}>
                      Most Visited Places Around you
                    </Text>
                  </View>
                )}
              </BlurView>
            </View>
            
            {/* Skeleton Cards */}
            <SkeletonLoader />
          </ScrollView>
          
        </View>
      </>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  // If restaurant user, show Sales Dashboard instead
  if (isRestaurant) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Container - Gradient with Premium Finish */}
            <View style={styles.headerContainer}>
              <LinearGradient
                colors={["#FFF5F0", "#FFE5D9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientHeader}
              >
              </LinearGradient>
            </View>

            {/* Title Box */}
            <View style={styles.titleBoxWrapper}>
              <BlurView intensity={60} tint="light" style={styles.titleBox}>
                <Text style={[styles.titleMain, styles.titleMainLarge]}>Sales Dashboard</Text>
              </BlurView>
            </View>

            {/* Sales Dashboard Component */}
            <SalesDashboard token={token || ""} />
          </ScrollView>

        </View>
      </>
    );
  }

  // Regular users see the normal happening places content
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* Fixed Line - Shows only when scrolled */}
        {showFixedLine && (
          <View style={styles.fixedLine} />
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Header Container - Gradient with Premium Finish */}
          <View style={styles.headerContainer}>
            <LinearGradient
              colors={["#FFF5F0", "#FFE5D9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientHeader}
            >
            </LinearGradient>
          </View>

          {/* Title Box */}
          <View style={styles.titleBoxWrapper}>
            <BlurView intensity={60} tint="light" style={styles.titleBox}>
              <Text style={styles.titleMain}>Happening places</Text>
              <View style={styles.subtitleRow}>
                <Ionicons name="location" size={16} color="#E94A37" />
                <Text style={styles.titleSub}>
                  Most Visited Places Around you
                </Text>
              </View>
            </BlurView>
          </View>

          {/* SELECT YOUR FOOD SPOT Dropdown */}
          <View style={styles.dropdownWrapper}>
            <TouchableOpacity
              onPress={() => setDropdownOpen(!dropdownOpen)}
              activeOpacity={0.8}
              style={styles.dropdownButtonOuter}
            >
              <LinearGradient
                colors={['#FF2E2E', '#FF7A18']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dropdownButton}
              >
                <Ionicons name="location" size={18} color="#fff" />
                <Text style={styles.dropdownButtonText} numberOfLines={1}>
                  {selectedArea === 'All' ? 'SELECT YOUR FOOD SPOT AROUND 50KM' : selectedArea.name}
                </Text>
                <Ionicons
                  name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#fff"
                />
              </LinearGradient>
            </TouchableOpacity>

            {dropdownOpen && (
              <View style={styles.dropdownList}>
                {/* Search bar */}
                <View style={styles.areaSearchBar}>
                  <Ionicons name="search" size={16} color="#999" />
                  <TextInput
                    style={styles.areaSearchInput}
                    placeholder="Search area name..."
                    placeholderTextColor="#999"
                    value={areaSearchQuery}
                    onChangeText={searchAreas}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {areaSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setAreaSearchQuery(''); setAreaSearchResults([]); }}>
                      <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Show search results when searching, otherwise show normal list */}
                {areaSearchQuery.length >= 2 ? (
                  <ScrollView
                    style={styles.dropdownScroll}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {areaSearching ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#E94A37" />
                        <Text style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Searching...</Text>
                      </View>
                    ) : areaSearchResults.length === 0 ? (
                      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#999' }}>No areas found within 50km</Text>
                      </View>
                    ) : (
                      areaSearchResults.map((area, idx) => (
                        <TouchableOpacity
                          key={`search-${idx}`}
                          style={styles.dropdownItem}
                          onPress={() => handleAreaSelect(area)}
                        >
                          <Ionicons name="location" size={16} color="#999" />
                          <Text style={styles.dropdownItemText} numberOfLines={1}>
                            {area.name}
                          </Text>
                          {area.distance_km != null && (
                            <Text style={styles.dropdownDistance}>
                              {area.distance_km} km
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                ) : (
                  <>
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <View style={styles.recentSearchesSection}>
                        <View style={styles.recentSearchesHeader}>
                          <Ionicons name="time-outline" size={14} color="#999" />
                          <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
                          <TouchableOpacity onPress={clearRecentSearches} style={styles.clearRecentBtn}>
                            <Text style={styles.clearRecentText}>Clear</Text>
                          </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentSearchesScroll} keyboardShouldPersistTaps="handled">
                          {recentSearches.map((area, idx) => (
                            <TouchableOpacity
                              key={`recent-${idx}`}
                              style={styles.recentSearchChip}
                              onPress={() => handleAreaSelect(area)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="location" size={12} color="#E94A37" />
                              <Text style={styles.recentSearchChipText} numberOfLines={1}>{area.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* All option */}
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        selectedArea === 'All' && styles.dropdownItemActive,
                      ]}
                      onPress={() => handleAreaSelect('All')}
                    >
                      <Ionicons name="grid" size={18} color={selectedArea === 'All' ? '#E94A37' : '#666'} />
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { fontSize: 16, fontWeight: '700' },
                          selectedArea === 'All' && styles.dropdownItemTextActive,
                        ]}
                      >
                        All Places
                      </Text>
                    </TouchableOpacity>

                    {/* Area / locality names from Google Places */}
                    <ScrollView
                      style={styles.dropdownScroll}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {areasLoading ? (
                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#E94A37" />
                          <Text style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Loading nearby areas...</Text>
                        </View>
                      ) : nearbyAreas.length === 0 ? (
                        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: '#999' }}>No areas found nearby</Text>
                        </View>
                      ) : (
                        nearbyAreas.map((area, idx) => {
                          const isSelected = selectedArea !== 'All' && selectedArea.name === area.name;
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[
                                styles.dropdownItem,
                                isSelected && styles.dropdownItemActive,
                              ]}
                              onPress={() => handleAreaSelect(area)}
                            >
                              <Ionicons
                                name="location"
                                size={16}
                                color={isSelected ? '#E94A37' : '#999'}
                              />
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  isSelected && styles.dropdownItemTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {area.name}
                              </Text>
                              {area.distance_km != null && (
                                <Text style={styles.dropdownDistance}>
                                  {area.distance_km} km
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Area Vendor Cards - shown when a specific area is selected */}
          {selectedArea !== 'All' && (
            <View style={styles.areaPostsSection}>
              <Text style={styles.areaPostsTitle}>
                Posts in {selectedArea.name}
              </Text>
              {areaPostsLoading ? (
                <ActivityIndicator size="large" color="#E94A37" style={{ marginVertical: 30 }} />
              ) : areaPosts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="images-outline" size={48} color="#CCC" />
                  <Text style={styles.emptyTitle}>No posts yet</Text>
                </View>
              ) : (
                // Group posts by location_name and render as vendor cards
                (() => {
                  const grouped = {};
                  areaPosts.forEach((post) => {
                    const locName = post.location_name || selectedArea.name;
                    if (!grouped[locName]) grouped[locName] = [];
                    grouped[locName].push(post);
                  });
                  const areaLocations = Object.entries(grouped).map(([name, posts]) => {
                    // Sort posts by latest first (newest created_at on top)
                    const sorted = [...posts].sort((a, b) => {
                      const dateA = a.created_at ? new Date(a.created_at) : 0;
                      const dateB = b.created_at ? new Date(b.created_at) : 0;
                      return dateB - dateA;
                    });
                    return {
                      location: name,
                      uploads: sorted.length,
                      images: sorted.map((p) => p.media_url).filter(Boolean),
                      thumbnails: sorted.map((p) => p.thumbnail_url).filter(Boolean),
                      images_data: sorted.map((p) => ({
                        media_type: p.media_type || 'image',
                        thumbnail_url: p.thumbnail_url,
                        dish_name: p.dish_name,
                        clicks_count: p.clicks_count || 0,
                        views_count: p.views_count || 0,
                      })),
                    };
                  })
                  // Sort by highest number of posts first
                  .sort((a, b) => b.uploads - a.uploads);

                  return areaLocations.map((location, index) => {
                    const images = location.images || [];
                    const thumbnails = location.thumbnails || [];
                    const imagesData = location.images_data || [];
                    const locationKey = `area-${location.location}-${index}`;

                    return (
                      <TouchableOpacity
                        key={locationKey}
                        style={styles.cardOuter}
                        onPress={() => handleLocationPress(location)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['rgba(255, 122, 24, 0.35)', 'rgba(255, 122, 24, 0.15)', 'rgba(255, 255, 255, 1)']}
                          locations={[0, 0.3, 1]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={styles.card}
                        >
                          <View style={styles.cardHeader}>
                            <View style={styles.rankNumber}>
                              <LinearGradient
                                colors={['#FF2E2E', '#FF7A18']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.rankGradient}
                              >
                                <Text style={styles.rankNumberText}>{index + 1}</Text>
                              </LinearGradient>
                            </View>
                            <View style={styles.locationInfo}>
                              <Text style={styles.locationName} numberOfLines={1}>
                                {location.location}
                              </Text>
                              <Text style={styles.uploadCount}>
                                ({formatUploadCount(location.uploads)} uploaded)
                              </Text>
                            </View>
                          </View>

                          <View style={styles.imageGrid}>
                            {images.length > 0 ? (
                              <>
                                {/* First Row - 3 images/videos */}
                                <View style={styles.imageRow}>
                                  {images.slice(0, 3).map((imageUrl, imgIndex) =>
                                    renderMediaItem(imageUrl, imgIndex, imagesData, thumbnails, locationKey)
                                  )}
                                </View>

                                {/* Second Row - 2 images/videos */}
                                <View style={styles.imageRow}>
                                  {images[3] && renderMediaItem(images[3], 3, imagesData, thumbnails, locationKey)}

                                  {images.length === 5 ? (
                                    renderMediaItem(images[4], 4, imagesData, thumbnails, locationKey)
                                  ) : images.length > 5 ? (
                                    <View style={styles.blurredImageWrapper}>
                                      {(() => {
                                        const imageData = imagesData[4] || {};
                                        const isVideo = isVideoFile(images[4]) || imageData.media_type === 'video';

                                        let displayUrl = null;
                                        if (isVideo) {
                                          const thumbnailUrl = imageData.thumbnail_url
                                            ? fixUrl(imageData.thumbnail_url)
                                            : (thumbnails[4] ? fixUrl(thumbnails[4]) : null);
                                          if (thumbnailUrl) {
                                            displayUrl = thumbnailUrl;
                                          } else {
                                            displayUrl = fixUrl(images[4], { thumbnail: true });
                                          }
                                        } else {
                                          displayUrl = fixUrl(images[4], { thumbnail: true });
                                        }

                                        if (!displayUrl) return null;
                                        return (
                                          <Image
                                            source={{ uri: displayUrl }}
                                            style={styles.gridImageSquare}
                                            contentFit="cover"
                                            blurRadius={8}
                                            placeholder={{ blurhash: BLUR_HASH }}
                                          />
                                        );
                                      })()}
                                      <View style={styles.countButtonOverlay}>
                                        <LinearGradient
                                          colors={['#FF2E2E', '#FF7A18']}
                                          start={{ x: 0, y: 0 }}
                                          end={{ x: 1, y: 1 }}
                                          style={styles.countButtonGradientBorder}
                                        >
                                          <Text style={styles.countButtonText}>
                                            +{location.uploads || images.length}
                                          </Text>
                                        </LinearGradient>
                                      </View>
                                    </View>
                                  ) : null}
                                </View>
                              </>
                            ) : (
                              <View style={styles.noImagePlaceholder}>
                                <Ionicons name="image-outline" size={32} color="#CCC" />
                              </View>
                            )}
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  });
                })()
              )}
            </View>
          )}

          {/* Empty State */}
          {topLocations.length === 0 && selectedArea === 'All' && (
            <View style={styles.emptyState}>
              <Ionicons
                name="location-outline"
                size={64}
                color="#CCC"
              />
              <Text style={styles.emptyTitle}>
                No locations yet
              </Text>
              <Text style={styles.emptySubtext}>
                Start posting with location tags to see popular
                places here!
              </Text>
            </View>
          )}

          {/* Location Cards - only show when "All" is selected */}
          {selectedArea === 'All' && topLocations.slice(0, visibleCards).map((location, index) => {
            const images = location.images || [];
            const thumbnails = location.thumbnails || [];
            const imagesData = location.images_data || [];
            const locationKey = location.location || location.location_name || index;

            return (
              <TouchableOpacity
                key={locationKey}
                style={styles.cardOuter}
                onPress={() => handleLocationPress(location)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(255, 122, 24, 0.35)', 'rgba(255, 122, 24, 0.15)', 'rgba(255, 255, 255, 1)']}
                  locations={[0, 0.3, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.card}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.rankNumber}>
                      <LinearGradient
                        colors={['#FF2E2E', '#FF7A18']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.rankGradient}
                      >
                        <Text style={styles.rankNumberText}>{index + 1}</Text>
                      </LinearGradient>
                    </View>
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationName} numberOfLines={1}>
                        {location.location || location.location_name}
                      </Text>
                      <Text style={styles.uploadCount}>
  ({formatUploadCount(location.uploads)} uploaded)
  {location.distance_km !== undefined && location.distance_km !== 49 && ` • ${location.distance_km} km away`}
</Text>
                    </View>
                  </View>

                  <View style={styles.imageGrid}>
                    {images.length > 0 ? (
                      <>
                        {/* First Row - 3 images/videos */}
                        <View style={styles.imageRow}>
                          {images.slice(0, 3).map((imageUrl, imgIndex) => 
                            renderMediaItem(imageUrl, imgIndex, imagesData, thumbnails, locationKey)
                          )}
                        </View>

                        {/* Second Row - 2 images/videos */}
                        <View style={styles.imageRow}>
                          {images[3] && renderMediaItem(images[3], 3, imagesData, thumbnails, locationKey)}

                          {images.length === 5 ? (
                            renderMediaItem(images[4], 4, imagesData, thumbnails, locationKey)
                          ) : images.length > 5 ? (
                            // More than 5 - show blurred with total count
                            <View style={styles.blurredImageWrapper}>
                              {(() => {
                                const imageData = imagesData[4] || {};
                                const isVideo = isVideoFile(images[4]) || imageData.media_type === 'video';

                                let displayUrl = null;
                                if (isVideo) {
                                  const thumbnailUrl = imageData.thumbnail_url
                                    ? fixUrl(imageData.thumbnail_url)
                                    : (thumbnails[4] ? fixUrl(thumbnails[4]) : null);
                                  if (thumbnailUrl) {
                                    displayUrl = thumbnailUrl;
                                  } else {
                                    displayUrl = fixUrl(images[4], { thumbnail: true });
                                  }
                                } else {
                                  displayUrl = fixUrl(images[4], { thumbnail: true });
                                }

                                if (!displayUrl) return null;
                                return (
                                  <Image
                                    source={{ uri: displayUrl }}
                                    style={styles.gridImageSquare}
                                    contentFit="cover"
                                    blurRadius={8}
                                    placeholder={{ blurhash: BLUR_HASH }}
                                    onError={(error) => {
                                      console.error("❌ Blurred image load error:", displayUrl, error);
                                    }}
                                  />
                                );
                              })()}
                              <View style={styles.countButtonOverlay}>
                                <LinearGradient
                                  colors={['#FF2E2E', '#FF7A18']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={styles.countButtonGradientBorder}
                                >
                                  <Text style={styles.countButtonText}>
                                    +{location.uploads || images.length}
                                  </Text>
                                </LinearGradient>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </>
                    ) : (
                      <View style={styles.noImagePlaceholder}>
                        <Ionicons name="image-outline" size={32} color="#CCC" />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}

          {/* Load More Button */}
          {selectedArea === 'All' && visibleCards < topLocations.length && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => setVisibleCards(prev => Math.min(prev + 3, topLocations.length))}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#FF2E2E', '#FF7A18']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loadMoreGradient}
              >
                <Text style={styles.loadMoreText}>Load More</Text>
                <Ionicons name="chevron-down" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>

      </View>
    </>
  );
}


/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },

  // Fixed line below status bar - appears on scroll
  fixedLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },

  /* Header Container */
  headerContainer: {
    marginBottom: -40,
  },

  /* Gradient Header - PREMIUM FINISH */
  gradientHeader: {
    paddingTop: 60,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },

  headerTitle: {
    fontFamily: 'Lobster',
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 4, height: 6 },
    textShadowRadius: 4,
  },

  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 100,
  },

  titleBoxWrapper: {
    marginHorizontal: 40,
    marginBottom: 16,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#FF8C00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  cardOuter: {
    marginHorizontal: 4,
    marginBottom: 12,
    borderRadius: 15,
    backgroundColor: '#fff',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  titleBox: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.3)',
  },

  gridImageContainer: {
    flex: 1,
    height: 130,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 0.5,
    borderColor: '#000',
  },

  videoPlayIcon: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 14,
    padding: 0,
  },

  titleMain: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  titleMainLarge: {
    fontSize: 24,
    fontWeight: '700',
  },

  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 6,
  },
  titleSub: {
    fontSize: 14,
    color: '#666',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    paddingVertical: 4,
  },
  rankNumber: {
    width: 20,
    height: 20,
    borderRadius: 12,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rankGradient: {
    width: 26,
    height: 26,
    borderRadius: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  locationInfo: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 10,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 1,
  },
  uploadCount: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    fontWeight: '400',
  },
  imageGrid: {
    marginTop: 8,
  },

  imageRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 8,
  },

  gridImageLarge: {
    width: 80,
    height: 80,
    borderRadius: 8,
    flex: 1,
  },

  // Skeleton styles
skeletonContainer: {
  paddingHorizontal: 20,
},
skeletonCard: {
  backgroundColor: '#fff',
  borderRadius: 15,
  padding: 12,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#E8E8E8',
},
skeletonHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 12,
},
skeletonRank: {
  width: 26,
  height: 26,
  borderRadius: 13,
  backgroundColor: '#E0E0E0',
  marginRight: 10,
},
skeletonTitleContainer: {
  flex: 1,
},
skeletonTitle: {
  height: 16,
  width: '60%',
  backgroundColor: '#E0E0E0',
  borderRadius: 4,
  marginBottom: 6,
},
skeletonSubtitle: {
  height: 12,
  width: '30%',
  backgroundColor: '#E0E0E0',
  borderRadius: 4,
},
skeletonImageRow: {
  flexDirection: 'row',
  gap: 3,
  marginBottom: 8,
},
skeletonImage: {
  flex: 1,
  height: 130,
  backgroundColor: '#E0E0E0',
  borderRadius: 10,
},
skeletonImageLarge: {
  flex: 1,
  height: 130,
  backgroundColor: '#E0E0E0',
  borderRadius: 10,
},

  gridImageSquare: {
    flex: 1,
    height: 130,
    borderRadius: 10,
  },

  gridImageSmall: {
    width: 100,
    height: 100,
    borderRadius: 12,
    flex: 1,
  },

  blurredImageWrapper: {
    flex: 1,
    height: 130,
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#000',
  },

  countButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },

  countButton: {
    width: 65,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 12,
  },
  countButtonGradientBorder: {
    width: 55,
    height: 30,
    borderRadius: 20,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  countButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  noImagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  moreImagesContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },

  moreImagesOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  moreImagesText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },

  blurredImageContainer: {
    width: 70,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  overlayCount: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  overlayCountText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 20,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  /* Bottom Navigation - Same as Explore */
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  navLabel: {
    fontSize: 11,
    color: '#000',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },

  navLabelActive: {
    fontSize: 11,
    color: '#000',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '700',
  },

  navIconGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Center elevated item
  centerNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -30,
  },

  // Circle background for center icon
  centerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  // Load More Button
  loadMoreButton: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadMoreGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Dropdown styles
  dropdownWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
    zIndex: 100,
  },
  dropdownButtonOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemActive: {
    backgroundColor: '#FFF5F0',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  dropdownItemTextActive: {
    color: '#E94A37',
    fontWeight: '600',
  },
  dropdownDistance: {
    fontSize: 12,
    color: '#999',
  },
  areaSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  areaSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 6,
  },

  // Area Posts Section styles
  areaPostsSection: {
    marginHorizontal: 0,
    marginBottom: 16,
  },
  areaPostsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  areaPostsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  areaPostItem: {
    width: (Dimensions.get('window').width - 46) / 3,
    height: (Dimensions.get('window').width - 46) / 3,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  areaPostImage: {
    width: '100%',
    height: '100%',
  },
  areaPostVideoIcon: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },

  // Grid overlay badges (dish name + clicks)
  gridClicksBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  gridClicksText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  gridDishTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(233, 74, 55, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    maxWidth: '80%',
  },
  gridDishText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },

  // Recent Searches styles
  recentSearchesSection: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recentSearchesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  recentSearchesTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearRecentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  clearRecentText: {
    fontSize: 12,
    color: '#E94A37',
    fontWeight: '600',
  },
  recentSearchesScroll: {
    marginBottom: 6,
  },
  recentSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FFE0D0',
  },
  recentSearchChipText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    maxWidth: 120,
  },
});
