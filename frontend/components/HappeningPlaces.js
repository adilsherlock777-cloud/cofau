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

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
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

  const renderMediaItem = (imageUrl, imgIndex, imagesData, thumbnails, locationKey) => {
    const fixedUrl = fixUrl(imageUrl, { thumbnail: true });
    const imageData = imagesData[imgIndex] || {};
    const thumbnailUrl = imageData.thumbnail_url
      ? fixUrl(imageData.thumbnail_url)
      : (thumbnails[imgIndex] ? fixUrl(thumbnails[imgIndex]) : null);
    const isVideo = isVideoFile(imageUrl) || imageData.media_type === 'video';
    
    const videoId = `${locationKey}-${imgIndex}`;

    if (isVideo) {
      if (!fixedUrl) return null;
      return (
        <VideoThumbnail
          key={imgIndex}
          videoId={videoId}
          videoUrl={fixedUrl}
          thumbnailUrl={thumbnailUrl}
          style={styles.gridImageContainer}
          shouldPlay={playingVideos.includes(videoId)}
          onLayout={(id, e) => {
            e.target.measureInWindow((x, y, width, height) => {
              videoPositions.current.set(id, { top: y, height });
            });
          }}
        />
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
        </View>
      );
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (token) {
      getCurrentLocation().then((coords) => {
        if (coords) {
          fetchTopLocations(coords);
        } else {
          fetchTopLocations();
        }
      });
    }
  }, [token]);

  useFocusEffect(
    React.useCallback(() => {
      if (token) {
        console.log('🔄 HappeningPlaces screen focused - refreshing locations');
        
        if (userLocation) {
          fetchTopLocations(userLocation);
        } else {
          getCurrentLocation().then((coords) => {
            if (coords) {
              fetchTopLocations(coords);
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
          
          {/* Bottom Navigation */}
          <View style={styles.navBar}>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/feed')}>
              <Ionicons name="home-outline" size={20} color="#000" />
              <Text style={styles.navLabel}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/explore')}>
              <Ionicons name={accountType === 'restaurant' ? "analytics-outline" : "compass-outline"} size={20} color="#000" />
              <Text style={styles.navLabel}>{accountType === 'restaurant' ? 'Dashboard' : 'Explore'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push('/leaderboard')}>
              <View style={styles.centerIconCircle}>
                <Ionicons name="fast-food" size={22} color="#000" />
              </View>
              <Text style={styles.navLabel}>{accountType === 'restaurant' ? 'Orders' : 'Delivery'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/happening')}>
              <LinearGradient colors={['#FF8C00', '#E94A37']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navIconGradient}>
                <Ionicons name={accountType === 'restaurant' ? "analytics" : "location"} size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.navLabelActive}>{accountType === 'restaurant' ? 'Sales' : 'Happening'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/profile')}>
              <Ionicons name="person-outline" size={20} color="#000" />
              <Text style={styles.navLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
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

          {/* Bottom Navigation */}
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/feed')}
            >
              <Ionicons name="home-outline" size={20} color="#000" />
              <Text style={styles.navLabel}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/explore')}
            >
              <Ionicons name={accountType === 'restaurant' ? "analytics-outline" : "compass-outline"} size={20} color="#000" />
              <Text style={styles.navLabel}>{accountType === 'restaurant' ? 'Dashboard' : 'Explore'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.centerNavItem}
              onPress={() => router.push('/leaderboard')}
            >
              <View style={styles.centerIconCircle}>
                <Ionicons name="fast-food" size={22} color="#000" />
              </View>
              <Text style={styles.navLabel}>{accountType === 'restaurant' ? 'Orders' : 'Delivery'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/happening')}
            >
              <LinearGradient
                colors={['#FF8C00', '#E94A37']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.navIconGradient}
              >
                <Ionicons name={accountType === 'restaurant' ? "analytics" : "location"} size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.navLabelActive}>{accountType === 'restaurant' ? 'Sales' : 'Happening'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/profile')}
            >
              <Ionicons name="person-outline" size={20} color="#000" />
              <Text style={styles.navLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
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

          {/* Empty State */}
          {topLocations.length === 0 && (
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

          {/* Location Cards */}
          {topLocations.slice(0, visibleCards).map((location, index) => {
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
          {visibleCards < topLocations.length && (
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

        {/* Bottom Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/feed')}
          >
            <Ionicons name="home-outline" size={20} color="#000" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/explore')}
          >
            <Ionicons name={accountType === 'restaurant' ? "analytics-outline" : "compass-outline"} size={20} color="#000" />
            <Text style={styles.navLabel}>{accountType === 'restaurant' ? 'Dashboard' : 'Explore'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.centerNavItem}
            onPress={() => router.push('/leaderboard')}
          >
            <View style={styles.centerIconCircle}>
              <Ionicons name="fast-food" size={22} color="#000" />
            </View>
            <Text style={styles.navLabel}>{accountType === 'restaurant' ? 'Orders' : 'Delivery'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/happening')}
          >
            <LinearGradient
              colors={['#FF8C00', '#E94A37']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.navIconGradient}
            >
              <Ionicons name={accountType === 'restaurant' ? "analytics" : "location"} size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.navLabelActive}>{accountType === 'restaurant' ? 'Sales' : 'Happening'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person-outline" size={20} color="#000" />
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
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
    padding: 12,
    marginHorizontal: 20,
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
    height: 110,
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
  height: 110,
  backgroundColor: '#E0E0E0',
  borderRadius: 10,
},
skeletonImageLarge: {
  flex: 1,
  height: 110,
  backgroundColor: '#E0E0E0',
  borderRadius: 10,
},

  gridImageSquare: {
    flex: 1,
    height: 110,
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
    height: 110,
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
});
