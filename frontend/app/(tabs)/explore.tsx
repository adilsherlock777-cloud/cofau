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
  Animated,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import { Image } from "expo-image";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { likePost, unlikePost } from "../../utils/api";
import UserAvatar from "../../components/UserAvatar";
import CofauVerifiedBadge from "../../components/CofauVerifiedBadge";
let MapView: any;
let Marker: any;
let Callout: any;
try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
} catch {
  MapView = ({ children, style, ...props }: any) => (
    <View style={[style, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
      <Text>Maps not available in Expo Go</Text>
    </View>
  );
  Marker = View;
  Callout = View;
}
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Veg / Non-veg FSSAI-style dot icon (green square+dot for veg, red for non-veg)
const FoodTypeIcon = ({ type, size = 20 }: { type: 'veg' | 'nonveg'; size?: number }) => {
  const color = type === 'veg' ? '#22C55E' : '#E02D2D';
  return (
    <View style={{ width: size, height: size, borderRadius: 3, borderWidth: 1.5, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: size * 0.45, height: size * 0.45, borderRadius: size * 0.45, backgroundColor: color }} />
    </View>
  );
};

const renderCategoryIcon = (emoji: string, size: number, marginRight = 0) => {
  if (emoji === '__veg__') return <View style={{ marginRight }}><FoodTypeIcon type="veg" size={size} /></View>;
  if (emoji === '__nonveg__') return <View style={{ marginRight }}><FoodTypeIcon type="nonveg" size={size} /></View>;
  return <Text style={{ fontSize: size, marginRight }}>{emoji}</Text>;
};

// Mini confetti for rank 1 hero card
const CONFETTI_ITEMS = ['🎉', '✨', '🏆', '⭐', '🥇', '🎯', '💫', '🔥', '❤️', '🌟'];
const CONFETTI_COUNT = 14;

const ConfettiPiece = memo(({ index }: { index: number }) => {
  const fall = useRef(new Animated.Value(-30)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  const startX = Math.random() * 90 + 5;
  const emoji = CONFETTI_ITEMS[index % CONFETTI_ITEMS.length];
  const size = 12 + Math.random() * 6;
  const delay = index * 200;
  const duration = 2500 + Math.random() * 1000;

  useEffect(() => {
    const animate = () => {
      fall.setValue(-30);
      sway.setValue(0);
      spin.setValue(0);
      fadeOut.setValue(1);
      Animated.parallel([
        Animated.timing(fall, { toValue: 280, duration, delay, useNativeDriver: true }),
        Animated.timing(sway, { toValue: (Math.random() - 0.5) * 80, duration, delay, useNativeDriver: true }),
        Animated.timing(spin, { toValue: 360, duration, delay, useNativeDriver: true }),
        Animated.timing(fadeOut, { toValue: 0, duration, delay: delay + duration * 0.65, useNativeDriver: true }),
      ]).start(() => animate());
    };
    animate();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${startX}%`,
        top: 0,
        opacity: fadeOut,
        transform: [
          { translateY: fall },
          { translateX: sway },
          { rotate: spin.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    >
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
});

const HeroConfetti = memo(() => (
  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 }} pointerEvents="none">
    {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
      <ConfettiPiece key={i} index={i} />
    ))}
  </View>
));

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
  <MaskedView maskElement={<Ionicons name="heart" size={size} color="#000" />}>
    <LinearGradient colors={["#FF2E2E", "#FF7A18"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size }} />
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

const VideoTile = memo(({ item, onPress, onLike, shouldPlay, onLayout, onView }: any) => {
  const tileRouter = useRouter();
  const videoRef = useRef<Video>(null);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const viewTracked = useRef(false);

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
        // Track view once when video starts playing
        if (!viewTracked.current && !item.is_viewed && onView) {
          viewTracked.current = true;
          onView(item.id);
        }
      } else {
        await videoRef.current.pauseAsync();
      }
    } catch (e) {
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
      <View style={styles.clicksBadge}>
        <Ionicons name="eye-outline" size={9} color="#fff" />
        <Text style={styles.clicksText}>{(item.views_count || 0) > 1000 ? `${((item.views_count || 0) / 1000).toFixed(1)}K` : (item.views_count || 0)}</Text>
      </View>
      {item.dish_name && (
        <TouchableOpacity style={styles.dishNameTag} activeOpacity={0.7} onPress={(e) => { e.stopPropagation(); tileRouter.push({ pathname: "/search-results", params: { query: item.dish_name } }); }}>
          <Text style={styles.dishNameText} numberOfLines={1}>{item.dish_name.toUpperCase()}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

const ImageTile = memo(({ item, onPress, onLike }: any) => {
  const tileRouter = useRouter();
  const displayUrl = item.full_thumbnail_url || item.full_image_url;
  return (
    <TouchableOpacity style={[styles.tile, { height: item.tileHeight }]} activeOpacity={0.9} onPress={() => onPress(item.id)}>
      {displayUrl ? (
        <Image source={{ uri: displayUrl }} style={styles.tileImage} placeholder={{ blurhash: BLUR_HASH }} cachePolicy="memory-disk" contentFit="cover" transition={200} recyclingKey={item.id} />
      ) : (
        <View style={[styles.tileImage, styles.placeholderImage]}><Ionicons name="image-outline" size={32} color="#ccc" /></View>
      )}
      <View style={styles.clicksBadge}>
        <MaterialCommunityIcons name="gesture-tap" size={10} color="#fff" />
        <Text style={styles.clicksText}>{(item.clicks_count || 0) > 1000 ? `${((item.clicks_count || 0) / 1000).toFixed(1)}K` : (item.clicks_count || 0)}</Text>
      </View>
      {item.dish_name && (
        <TouchableOpacity style={styles.dishNameTag} activeOpacity={0.7} onPress={(e) => { e.stopPropagation(); tileRouter.push({ pathname: "/search-results", params: { query: item.dish_name } }); }}>
          <Text style={styles.dishNameText} numberOfLines={1}>{item.dish_name.toUpperCase()}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

const GridTile = memo(({ item, onPress, onLike, onVideoLayout, playingVideos, onView }: any) => {
  if (item._isVideo) {
    return <VideoTile item={item} onPress={onPress} onLike={onLike} shouldPlay={playingVideos.includes(item.id)} onLayout={onVideoLayout} onView={onView} />;
  }
  return <ImageTile item={item} onPress={onPress} onLike={onLike} />;
});

// ======================================================
// CORRECTED MAP MARKERS - Copy these to your ExploreScreen.tsx
// ======================================================

const RestaurantMarker = memo(({ restaurant, onPress }: any) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, 5000); // Increased to 5s for Android image loading
    return () => clearTimeout(timer);
  }, []);

  // Android - Use expo-image for reliable rendering inside map markers
  if (Platform.OS === 'android') {
    const imageUrl = fixUrl(restaurant.profile_picture);

    return (
      <Marker
        coordinate={{
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
        }}
        onPress={() => onPress(restaurant)}
        tracksViewChanges={tracksChanges && !imageLoaded}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            padding: 3,
            elevation: 5,
          }}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: 60, height: 60 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                onLoad={() => {
                  setImageLoaded(true);
                  setTracksChanges(false);
                }}
              />
            ) : (
              <View style={{ width: 60, height: 60, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="restaurant" size={28} color="#fff" />
              </View>
            )}
          </View>
          {/* Reviews badge */}
          <View style={{
            position: 'absolute',
            bottom: -8,
            backgroundColor: '#E94A37',
            borderRadius: 10,
            paddingVertical: 2,
            paddingHorizontal: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            elevation: 6,
          }}>
            <Ionicons name="chatbubble" size={10} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
              {restaurant.review_count || 0}
            </Text>
          </View>
        </View>
      </Marker>
    );
  }

  // iOS rendering
  return (
    <Marker
      coordinate={{
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
      }}
      onPress={() => onPress(restaurant)}
      tracksViewChanges={tracksChanges && !imageLoaded}
    >
      <View style={styles.restaurantMarkerContainer}>
        <View style={styles.restaurantMarkerBubble}>
          {restaurant.profile_picture ? (
            <Image
              source={{ uri: fixUrl(restaurant.profile_picture) || '' }}
              style={styles.restaurantMarkerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <View style={styles.restaurantMarkerPlaceholder}>
              <Ionicons name="restaurant" size={28} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.reviewsBadge}>
          <Ionicons name="chatbubble" size={10} color="#fff" />
          <Text style={styles.reviewsBadgeText}>{restaurant.review_count || 0}</Text>
        </View>
        <View style={styles.markerArrow} />
      </View>
    </Marker>
  );
});

// Single Post Marker (for locations with 1 post)
const PostMarker = memo(({ post, onPress }: any) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!post.latitude || !post.longitude) {
    return null;
  }

  // Stop tracking after image loads or timeout
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, 5000); // Increased to 5s for Android image loading
    return () => clearTimeout(timer);
  }, []);

  // Android - Use expo-image for reliable rendering inside map markers
  if (Platform.OS === 'android') {
    const imageUrl = post.full_thumbnail_url || post.full_image_url;

    return (
      <Marker
        coordinate={{
          latitude: post.latitude,
          longitude: post.longitude,
        }}
        onPress={() => onPress(post)}
        tracksViewChanges={tracksChanges && !imageLoaded}
      >
        <View style={{
          backgroundColor: '#FFFFFF',
          padding: 3,
          elevation: 5,
        }}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: 60, height: 60 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => {
                setImageLoaded(true);
                setTracksChanges(false);
              }}
            />
          ) : (
            <View style={{ width: 60, height: 60, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="image" size={24} color="#fff" />
            </View>
          )}
        </View>
      </Marker>
    );
  }

  // iOS rendering
  return (
    <Marker
      coordinate={{
        latitude: post.latitude,
        longitude: post.longitude,
      }}
      onPress={(e: any) => {
        e?.stopPropagation?.();
        onPress(post);
      }}
      tracksViewChanges={tracksChanges && !imageLoaded}
      zIndex={post.id ? parseInt(String(post.id).replace(/\D/g, '').slice(-6) || '1', 10) : 1}
      stopPropagation={true}
    >
      <View style={styles.postMarkerContainer}>
        <View style={styles.postMarkerBubble}>
          {post.full_thumbnail_url || post.full_image_url ? (
            <Image
              source={{ uri: post.full_thumbnail_url || post.full_image_url }}
              style={styles.postMarkerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <View style={styles.postMarkerPlaceholder}>
              <Ionicons name="image" size={24} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.postMarkerArrow} />
      </View>
    </Marker>
  );
});

// Cluster Marker (for locations with multiple posts)
const ClusterMarker = memo(({ cluster, onPress, categoryEmoji }: any) => {
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [tracksChanges, setTracksChanges] = useState(true);
  const { posts, latitude, longitude, count } = cluster;

  // Get latest 3 posts (sorted by newest first)
  const latestPosts = [...posts]
    .sort((a: any, b: any) => (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime()))
    .slice(0, 3);

  // Stop tracking after images load or timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, 5000); // Increased to 5s for Android image loading
    return () => clearTimeout(timer);
  }, []);

  // Android - Use expo-image for reliable rendering inside map markers
  if (Platform.OS === 'android') {
    const image1 = latestPosts[0]?.full_thumbnail_url || latestPosts[0]?.full_image_url;
    const image2 = latestPosts[1]?.full_thumbnail_url || latestPosts[1]?.full_image_url;

    return (
      <Marker
        coordinate={{ latitude, longitude }}
        onPress={() => onPress(cluster)}
        tracksViewChanges={tracksChanges}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Second image (behind) */}
          {image2 && (
            <View style={{
              backgroundColor: '#FFFFFF',
              padding: 2,
              elevation: 4,
              marginRight: -20,
            }}>
              <Image
                source={{ uri: image2 }}
                style={{ width: 50, height: 50 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                onLoad={() => setImagesLoaded(prev => prev + 1)}
              />
            </View>
          )}
          {/* First image (front) */}
          <View style={{
            backgroundColor: '#FFFFFF',
            padding: 2,
            elevation: 6,
          }}>
            {image1 ? (
              <Image
                source={{ uri: image1 }}
                style={{ width: 50, height: 50 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                onLoad={() => {
                  setImagesLoaded(prev => prev + 1);
                  setTracksChanges(false);
                }}
              />
            ) : (
              <View style={{ width: 50, height: 50, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="image" size={20} color="#fff" />
              </View>
            )}
          </View>
          {/* Count badge */}
          <View style={{
            backgroundColor: '#E94A37',
            borderRadius: 12,
            minWidth: 24,
            height: 24,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 6,
            marginLeft: -12,
            marginTop: -30,
            elevation: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{count}</Text>
          </View>
        </View>
      </Marker>
    );
  }

  // iOS layout with overlapping images
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={(e: any) => {
        e?.stopPropagation?.();
        onPress(cluster);
      }}
      tracksViewChanges={tracksChanges}
      zIndex={1000 + count}
      stopPropagation={true}
    >
      <View style={styles.clusterMarkerContainer}>
        {/* Preview Images */}
        <View style={[styles.clusterPreviewContainer, { width: 60 + (latestPosts.length - 1) * 45 }]}>
          {latestPosts.map((post: any, index: number) => (
            <View
              key={post.id}
              style={[
                styles.clusterPreviewImage,
                {
                  position: 'absolute',
                  left: index * 45,
                  zIndex: 3 - index,
                  elevation: 4 + (3 - index),
                }
              ]}
            >
              {post.full_thumbnail_url || post.full_image_url ? (
                <Image
                  source={{ uri: post.full_thumbnail_url || post.full_image_url }}
                  style={styles.clusterImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  onLoad={() => setImagesLoaded(prev => prev + 1)}
                />
              ) : (
                <View style={styles.clusterImagePlaceholder}>
                  <Ionicons name="image" size={16} color="#fff" />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Pin with count */}
        <View style={styles.clusterPinContainer}>
          <View style={[
            styles.clusterPin,
            categoryEmoji && styles.clusterPinWithEmoji
          ]}>
            {categoryEmoji ? (
              renderCategoryIcon(categoryEmoji, 18)
            ) : (
              <Ionicons name="location" size={18} color="#fff" />
            )}
          </View>
          <View style={styles.clusterCountBadge}>
            <Text style={styles.clusterCountText}>{count}</Text>
          </View>
          <View style={styles.clusterPinArrow} />
        </View>
      </View>
    </Marker>
  );
});

const LocationButton = memo(({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={styles.locationButton} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.locationButtonInner}>
      <Ionicons name="locate" size={22} color="#E94A37" />
    </View>
  </TouchableOpacity>
));

// Error boundary to prevent map crashes from killing the app (Android)
class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="map-outline" size={48} color="#999" />
          <Text style={{ color: '#666', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
            Map couldn't load. Please restart the app.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const MapViewComponent = memo(({
  userLocation,
  restaurants,
  posts,
  onRestaurantPress,
  onPostPress,
  onClusterPress,
  isLoading,
  mapRef,
  filterType,
  onFilterChange,
  onCenterLocation,
  selectedCategory,
}: any) => {
  // Delay map mount on Android to let Google Play Services initialize
  const [mapReady, setMapReady] = React.useState(Platform.OS !== 'android');
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const timer = setTimeout(() => setMapReady(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Group posts by location — use toFixed(3) (~111m) so nearby posts cluster
  // instead of overlapping as separate markers (which blocks taps on iOS)
  const { singlePosts, clusters } = React.useMemo(() => {
    const groups = new Map<string, any[]>();

    posts.forEach((post: any) => {
      if (post.latitude && post.longitude) {
        const key = `${post.latitude.toFixed(3)},${post.longitude.toFixed(3)}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(post);
      }
    });

    const singlePosts: any[] = [];
    const clusters: any[] = [];

    groups.forEach((groupPosts, key) => {
      const [lat, lng] = key.split(',').map(Number);

      // Sort posts within each group by latest uploaded first
      groupPosts.sort((a: any, b: any) =>
        (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime())
      );

      if (groupPosts.length === 1) {
        singlePosts.push(groupPosts[0]);
      } else {
        clusters.push({
          id: key,
          latitude: lat,
          longitude: lng,
          count: groupPosts.length,
          posts: groupPosts,
          locationName: groupPosts[0].location_name || 'This location',
        });
      }
    });

    return { singlePosts, clusters };
  }, [posts]);

 // Get category emoji
const getCategoryEmoji = (categoryName: string | null) => {
  if (!categoryName) return null;
  
  
  // Fallback mapping
  const CATEGORY_EMOJIS: { [key: string]: string } = {
    'Vegetarian/Vegan': '__veg__',
    'Non vegetarian': '__nonveg__',
    'Biryani': '🍛',
    'Desserts': '🍰',
    'SeaFood': '🦐',
    'Chinese': '🍜',
    'Chaats': '🥘',
    'Arabic': '🧆',
    'BBQ/Tandoor': '🍗',
    'Fast Food': '🍔',
    'Tea/Coffee': '☕',
    'Salad': '🥗',
    'Karnataka': '🍃',
    'Hyderabadi': '🌶️',
    'Kerala': '🥥',
    'Andhra': '🔥',
    'North Indian': '🫓',
    'South Indian': '🥞',
    'Punjabi': '🧈',
    'Bengali': '🐟',
    'Odia': '🍚',
    'Gujarati': '🥣',
    'Maharashtrian': '🍢',
    'Rajasthani': '🏜️',
    'Mangaluru': '🦀',
    'Goan': '🏖️',
    'Kashmiri': '🏔️',
    'Continental': '🌍',
    'Asian': '🥢',
    'Italian': '🍝',
    'Japanese': '🍣',
    'Korean': '🍱',
    'Mexican': '🌮',
    'Persian': '🫖',
    'Drinks / sodas': '🥤',
    'Pizza': '🍕',
    'Dosa': '🫕',
    'Cafe': '🧁',
  };
  return CATEGORY_EMOJIS[categoryName] || null;
};

  const categoryEmoji = getCategoryEmoji(selectedCategory);
  

  return (
    <View style={styles.mapContainer}>
      {userLocation && mapReady ? (
        <MapErrorBoundary>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
        >
          {/* Restaurant Markers */}
          {filterType === 'restaurants' && restaurants.map((restaurant: any) => (
            <RestaurantMarker
              key={`restaurant-${restaurant.id}`}
              restaurant={restaurant}
              onPress={onRestaurantPress}
            />
          ))}

          {/* Single Post Markers */}
          {(filterType === 'posts' || filterType === 'followers') && (() => {
            return singlePosts.map((post: any) => (
              <PostMarker
                key={`post-${post.id}`}
                post={post}
                onPress={onPostPress}
              />
            ));
          })()}

          {/* Cluster Markers */}
          {(filterType === 'posts' || filterType === 'followers') && clusters.map((cluster: any) => (
            <ClusterMarker
              key={`cluster-${cluster.id}`}
              cluster={cluster}
              onPress={onClusterPress}
              categoryEmoji={categoryEmoji}
            />
          ))}
        </MapView>
        </MapErrorBoundary>
      ) : (
        <View style={styles.mapLoadingContainer}>
          <ActivityIndicator size="large" color="#4dd0e1" />
          <Text style={styles.mapLoadingText}>Getting your location...</Text>
        </View>
      )}

      {/* Floating Toggle */}
      <View style={styles.mapFloatingToggle}>
        <TouchableOpacity
          style={[styles.mapToggleOption, filterType === 'posts' && styles.mapToggleOptionActive]}
          onPress={() => onFilterChange('posts')}
        >
          <Text style={[styles.mapToggleText, filterType === 'posts' && styles.mapToggleTextActive]}>Posts</Text>
        </TouchableOpacity>
        <View style={styles.mapToggleDivider} />
        <TouchableOpacity
          style={[styles.mapToggleOption, filterType === 'restaurants' && styles.mapToggleOptionActive]}
          onPress={() => onFilterChange('restaurants')}
        >
          <Text style={[styles.mapToggleText, filterType === 'restaurants' && styles.mapToggleTextActive]}>Restaurants</Text>
        </TouchableOpacity>
        <View style={styles.mapToggleDivider} />
        <TouchableOpacity
          style={[styles.mapToggleOption, filterType === 'followers' && styles.mapToggleOptionActive]}
          onPress={() => onFilterChange('followers')}
        >
          <Text style={[styles.mapToggleText, filterType === 'followers' && styles.mapToggleTextActive]}>Followers</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="small" color="#E94A37" />
        </View>
      )}

      {/* Results Count */}
      <View style={styles.resultsCountContainer}>
        <Text style={styles.resultsCountText}>
          {filterType === 'posts'
            ? `${posts.length} posts at ${singlePosts.length + clusters.length} locations`
            : filterType === 'restaurants'
            ? `${restaurants.length} restaurants nearby`
            : `${posts.length} posts from followers at ${singlePosts.length + clusters.length} locations`
          }
        </Text>
      </View>

      {/* Location Button */}
      <LocationButton onPress={onCenterLocation} />
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
                  <Ionicons name="checkmark-circle" size={16} color="#E94A37" />
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
              <Text style={styles.statNumber}>{restaurant.review_count || 0}</Text>
              <Text style={styles.statLabel}>Total Posts</Text>
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
                {post.user_badge === 'verified' && <CofauVerifiedBadge size={14} />}
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
// TOP POSTS MODAL
// ======================================================

const TopPostsModal = memo(({ visible, posts, loading, onClose, onViewPost }: any) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.topPostsModal}>
          <View style={styles.topPostsModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="trophy" size={22} color="#F2CF68" />
              <Text style={styles.topPostsModalTitle}>Top Posts</Text>
            </View>
            <Text style={styles.topPostsModalSubtitle}>Last 2 days</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#E94A37" />
              <Text style={{ marginTop: 12, color: '#666' }}>Loading top posts...</Text>
            </View>
          ) : posts.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="images-outline" size={48} color="#ccc" />
              <Text style={{ marginTop: 12, color: '#666', fontSize: 16 }}>No posts in the last 2 days</Text>
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.topPostItem} onPress={() => onViewPost(item)}>
                  <View style={[styles.rankBadge, item.rank <= 3 && { backgroundColor: '#F2CF68' }]}>
                    <Text style={[styles.rankText, item.rank <= 3 && { color: '#333' }]}>#{item.rank}</Text>
                  </View>
                  <Image
                    source={{ uri: fixUrl(item.thumbnail_url || item.media_url || item.image_url) || undefined }}
                    style={styles.topPostThumbnail}
                    contentFit="cover"
                    placeholder={{ blurhash: BLUR_HASH }}
                  />
                  <View style={styles.topPostInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      {item.user_profile_picture ? (
                        <Image source={{ uri: fixUrl(item.user_profile_picture) || undefined }} style={{ width: 20, height: 20, borderRadius: 10, marginRight: 6 }} contentFit="cover" />
                      ) : (
                        <View style={{ width: 20, height: 20, borderRadius: 10, marginRight: 6, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="person" size={12} color="#fff" />
                        </View>
                      )}
                      <Text style={styles.topPostUsername} numberOfLines={1}>{item.username}</Text>
                      {item.user_badge === 'verified' && <CofauVerifiedBadge size={12} />}
                    </View>
                    {item.location_name && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Ionicons name="location" size={12} color="#E94A37" />
                        <Text style={{ fontSize: 11, color: '#666', marginLeft: 2 }} numberOfLines={1}>{item.location_name}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="heart" size={13} color="#E94A37" />
                        <Text style={{ fontSize: 12, color: '#333', marginLeft: 3 }}>{item.likes_count}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="star" size={13} color="#F2CF68" />
                        <Text style={{ fontSize: 12, color: '#333', marginLeft: 3 }}>{Math.round(item.combined_score)}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
});

// ======================================================
// DASHBOARD CONTENT (for restaurant users)
// ======================================================

const StatCard = ({ icon, label, value, color, subtitle }: { icon: string; label: string; value: number; color: string; subtitle?: string; }) => (
  <View style={styles.dashboardStatCard}>
    <View style={[styles.dashboardStatIconContainer, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
    <Text style={styles.dashboardStatValue}>{(value ?? 0).toLocaleString()}</Text>
    <Text style={styles.dashboardStatLabel}>{label}</Text>
    {subtitle && <Text style={styles.dashboardStatSubtitle}>{subtitle}</Text>}
  </View>
);

const LargeStatCard = ({ icon, label, value, color, trend }: { icon: string; label: string; value: number; color: string; trend?: string; }) => (
  <View style={styles.dashboardLargeStatCard}>
    <View style={styles.dashboardLargeStatLeft}>
      <View style={[styles.dashboardLargeStatIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <View style={styles.dashboardLargeStatInfo}>
        <Text style={styles.dashboardLargeStatLabel}>{label}</Text>
        {trend && (
          <View style={styles.dashboardTrendContainer}>
            <Ionicons name="trending-up" size={14} color="#4CAF50" />
            <Text style={styles.dashboardTrendText}>{trend}</Text>
          </View>
        )}
      </View>
    </View>
    <Text style={[styles.dashboardLargeStatValue, { color: color }]}>{(value ?? 0).toLocaleString()}</Text>
  </View>
);

const DashboardContent = memo(({ analytics, loading, onRefresh }: { analytics: any; loading: boolean; onRefresh: () => void }) => {
  if (loading) {
    return (
      <View style={styles.dashboardLoadingContainer}>
        <ActivityIndicator size="large" color="#E94A37" />
        <Text style={styles.dashboardLoadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.dashboardScrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#E94A37" />}
    >
      {/* Analytics Header */}
      <View style={styles.dashboardAnalyticsHeader}>
        <Ionicons name="analytics" size={28} color="#E94A37" />
        <Text style={styles.dashboardAnalyticsTitle}>Analytics Overview</Text>
      </View>
      <Text style={styles.dashboardAnalyticsSubtitle}>
        Track your restaurant's performance
      </Text>

      {/* Primary Stats - 3 Column Grid */}
      <View style={styles.dashboardSectionTitle}>
        <Ionicons name="stats-chart" size={20} color="#333" />
        <Text style={styles.dashboardSectionTitleText}>Key Metrics</Text>
      </View>

      <View style={styles.dashboardStatsGrid}>
        <StatCard
          icon="images"
          label="Total Posts"
          value={analytics.total_posts}
          color="#E94A37"
        />
        <StatCard
          icon="people"
          label="Followers"
          value={analytics.followers_count}
          color="#1B7C82"
        />
        <StatCard
          icon="star"
          label="Reviews"
          value={analytics.customer_reviews}
          color="#F2CF68"
        />
      </View>

      {/* Engagement Stats - Large Cards */}
      <View style={styles.dashboardSectionTitle}>
        <Ionicons name="eye" size={20} color="#333" />
        <Text style={styles.dashboardSectionTitleText}>Visibility & Engagement</Text>
      </View>

      <LargeStatCard
        icon="eye"
        label="Profile Views"
        value={analytics.profile_views}
        color="#9C27B0"
        trend={analytics.profile_views_trend}
      />

      <LargeStatCard
        icon="footsteps"
        label="Profile Visits"
        value={analytics.profile_visits}
        color="#2196F3"
        trend={analytics.profile_visits_trend}
      />

      <LargeStatCard
        icon="search"
        label="Search Appearances"
        value={analytics.search_appearances}
        color="#FF9800"
        trend={analytics.search_appearances_trend}
      />

      <LargeStatCard
        icon="hand-left"
        label="Post Clicks"
        value={analytics.post_clicks}
        color="#4CAF50"
        trend={analytics.post_clicks_trend}
      />

      {/* Info Card */}
      <View style={styles.dashboardInfoCard}>
        <Ionicons name="information-circle" size={24} color="#1B7C82" />
        <View style={styles.dashboardInfoContent}>
          <Text style={styles.dashboardInfoTitle}>How to improve?</Text>
          <Text style={styles.dashboardInfoText}>
            Post regularly, respond to reviews, and keep your menu updated to increase visibility and engagement.
          </Text>
        </View>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
});

// ======================================================
// MAIN EXPLORE SCREEN
// ======================================================

export default function ExploreScreen() {
  const router = useRouter();
  const auth = useAuth() as { user: any; token: string | null; accountType: string | null };
  const { user, token, accountType } = auth;

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<typeof MapView>(null);
  const videoPositions = useRef<Map<string, { top: number; height: number }>>(new Map());
  const cachedMapPosts = useRef<any[]>([]);
  const cachedFollowersPosts = useRef<any[]>([]);
  const cachedUserLocation = useRef<{ latitude: number; longitude: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'map' | 'users' | 'topPosts'>(Platform.OS === 'android' ? 'users' : 'map');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Animated placeholder typing effect
  const PLACEHOLDER_WORDS = ['Biryani', 'Desserts', 'Pizza', 'Dosa', 'Chinese', 'BBQ', 'Coffee', 'Salad'];
  const [placeholderText, setPlaceholderText] = useState('');
  const placeholderRef = useRef({ wordIndex: 0, charIndex: 0, isDeleting: false });

  useEffect(() => {
    if (searchQuery || searchFocused) return;

    const timer = setInterval(() => {
      const { wordIndex, charIndex, isDeleting } = placeholderRef.current;
      const currentWord = PLACEHOLDER_WORDS[wordIndex];

      if (!isDeleting) {
        // Typing
        if (charIndex < currentWord.length) {
          setPlaceholderText(currentWord.substring(0, charIndex + 1));
          placeholderRef.current.charIndex = charIndex + 1;
        } else {
          // Pause at full word, then start deleting
          placeholderRef.current.isDeleting = true;
        }
      } else {
        // Deleting
        if (charIndex > 0) {
          setPlaceholderText(currentWord.substring(0, charIndex - 1));
          placeholderRef.current.charIndex = charIndex - 1;
        } else {
          // Move to next word
          placeholderRef.current.isDeleting = false;
          placeholderRef.current.wordIndex = (wordIndex + 1) % PLACEHOLDER_WORDS.length;
        }
      }
    }, placeholderRef.current.isDeleting ? 80 : 180);

    return () => clearInterval(timer);
  }, [searchQuery, searchFocused]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTopPostsModal, setShowTopPostsModal] = useState(false);
  const [showTopPostsInfo, setShowTopPostsInfo] = useState(false);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [topPostsLoading, setTopPostsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollYRef = useRef(0);
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
  const [mapFilterType, setMapFilterType] = useState<'posts' | 'restaurants' | 'followers'>('posts');

  // Dashboard state (for restaurant users)
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [analytics, setAnalytics] = useState({
    total_posts: 0,
    followers_count: 0,
    customer_reviews: 0,
    profile_visits: 0,
    profile_visits_trend: '',
    search_appearances: 0,
    search_appearances_trend: '',
    post_clicks: 0,
    post_clicks_trend: '',
    profile_views: 0,
    profile_views_trend: '',
  });

  const POSTS_PER_PAGE = 20;
  const CATEGORIES = [
  { id: 'all', name: 'All', emoji: '🍽️' },
  { id: 'vegetarian-vegan', name: 'Vegetarian/Vegan', emoji: '__veg__' },
  { id: 'non-vegetarian', name: 'Non vegetarian', emoji: '__nonveg__' },
  { id: 'biryani', name: 'Biryani', emoji: '🍛' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
  { id: 'seafood', name: 'SeaFood', emoji: '🦐' },
  { id: 'chinese', name: 'Chinese', emoji: '🍜' },
  { id: 'chaats', name: 'Chaats', emoji: '🥘' },
  { id: 'arabic', name: 'Arabic', emoji: '🧆' },
  { id: 'bbq-tandoor', name: 'BBQ/Tandoor', emoji: '🍗' },
  { id: 'fast-food', name: 'Fast Food', emoji: '🍔' },
  { id: 'tea-coffee', name: 'Tea/Coffee', emoji: '☕' },
  { id: 'salad', name: 'Salad', emoji: '🥗' },
  { id: 'karnataka-style', name: 'Karnataka', emoji: '🍃' },
  { id: 'hyderabadi-style', name: 'Hyderabadi', emoji: '🌶️' },
  { id: 'kerala-style', name: 'Kerala', emoji: '🥥' },
  { id: 'andhra-style', name: 'Andhra', emoji: '🔥' },
  { id: 'north-indian-style', name: 'North Indian', emoji: '🫓' },
  { id: 'south-indian-style', name: 'South Indian', emoji: '🥞' },
  { id: 'punjabi-style', name: 'Punjabi', emoji: '🧈' },
  { id: 'bengali-style', name: 'Bengali', emoji: '🐟' },
  { id: 'odia-style', name: 'Odia', emoji: '🍚' },
  { id: 'gujarati-style', name: 'Gujarati', emoji: '🥣' },
  { id: 'maharashtrian-style', name: 'Maharashtrian', emoji: '🍢' },
  { id: 'rajasthani-style', name: 'Rajasthani', emoji: '🏜️' },
  { id: 'mangaluru-style', name: 'Mangaluru', emoji: '🦀' },
  { id: 'goan', name: 'Goan', emoji: '🏖️' },
  { id: 'kashmiri', name: 'Kashmiri', emoji: '🏔️' },
  { id: 'continental', name: 'Continental', emoji: '🌍' },
  { id: 'asian', name: 'Asian', emoji: '🥢' },
  { id: 'italian', name: 'Italian', emoji: '🍝' },
  { id: 'japanese', name: 'Japanese', emoji: '🍣' },
  { id: 'korean', name: 'Korean', emoji: '🍱' },
  { id: 'mexican', name: 'Mexican', emoji: '🌮' },
  { id: 'persian', name: 'Persian', emoji: '🫖' },
  { id: 'drinks', name: 'Drinks / sodas', emoji: '🥤' },
  { id: 'pizza', name: 'Pizza', emoji: '🍕' },
  { id: 'dosa', name: 'Dosa', emoji: '🫕' },
  { id: 'cafe', name: 'Cafe', emoji: '🧁' },
];

// Show only popular categories in quick chips (names must match CATEGORIES exactly)
const QUICK_CATEGORIES = [
  { id: 'vegetarian-vegan', name: 'Vegetarian/Vegan', emoji: '__veg__' },
  { id: 'non-vegetarian', name: 'Non vegetarian', emoji: '__nonveg__' },
  { id: 'biryani', name: 'Biryani', emoji: '🍛' },
  { id: 'italian', name: 'Italian', emoji: '🍕' },
  { id: 'desserts', name: 'Desserts', emoji: '🍰' },
  { id: 'arabic', name: 'Arabic', emoji: '🧆' },
  { id: 'karnataka-style', name: 'Karnataka', emoji: '🍃' },
  { id: 'north-indian-style', name: 'North Indian', emoji: '🫓' },
  { id: 'south-indian-style', name: 'South Indian', emoji: '🥞' },
  { id: 'hyderabadi-style', name: 'Hyderabadi', emoji: '🌶️' },
  { id: 'kerala-style', name: 'Kerala', emoji: '🥥' },
  { id: 'andhra-style', name: 'Andhra', emoji: '🔥' },
  { id: 'punjabi-style', name: 'Punjabi', emoji: '🧈' },
  { id: 'dosa', name: 'Dosa', emoji: '🫕' },
  { id: 'tea-coffee', name: 'Tea/Coffee', emoji: '☕' },
  { id: 'bengali-style', name: 'Bengali', emoji: '🐟' },
  { id: 'asian', name: 'Asian', emoji: '🥢' },
  { id: 'odia-style', name: 'Odia', emoji: '🍚' },
  { id: 'gujarati-style', name: 'Gujarati', emoji: '🥣' },
  { id: 'maharashtrian-style', name: 'Maharashtrian', emoji: '🍢' },
  { id: 'rajasthani-style', name: 'Rajasthani', emoji: '🏜️' },
  { id: 'mangaluru-style', name: 'Mangaluru', emoji: '🦀' },
  { id: 'goan', name: 'Goan', emoji: '🏖️' },
  { id: 'kashmiri', name: 'Kashmiri', emoji: '🏔️' },
];

const centerOnUserLocation = useCallback(async () => {
  if (userLocation && mapRef.current) {
    mapRef.current.animateToRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
  } else {
    const coords = await getCurrentLocation();
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  }
}, [userLocation]);
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
      return false;
    }
  };

 const getCurrentLocation = async () => {
  try {
    // Return cached location if available (instant!)
    if (cachedUserLocation.current) {
      if (mountedRef.current) setUserLocation(cachedUserLocation.current);
      return cachedUserLocation.current;
    }

    const hasPermission = await requestLocationPermission();
    if (!hasPermission || !mountedRef.current) return null;

    // Try to get last known location first (instant)
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        cachedUserLocation.current = coords;
        if (mountedRef.current) setUserLocation(coords);
        return coords;
      }
    } catch (e) {
    }

    if (!mountedRef.current) return null;

    // Fallback to current position (slower but accurate)
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const coords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    // Cache the location
    cachedUserLocation.current = coords;
    if (mountedRef.current) setUserLocation(coords);
    return coords;
  } catch (error) {
    if (!mountedRef.current) return null;
    Alert.alert("Location Error", "Could not get your current location. Please try again.");
    return null;
  }
};
  // ======================================================
  // MAP DATA FETCHING
  // ======================================================

const fetchMapPins = async (searchTerm?: string, forceRefresh = false) => {
  if (!userLocation) return;

  // If we have cached posts and not forcing refresh, use cache
  if (!forceRefresh && !searchTerm && cachedMapPosts.current.length > 0) {
    if (mountedRef.current) setMapPosts(cachedMapPosts.current);
    return;
  }

  setMapLoading(true);
  try {
    let url: string;

    if (searchTerm && searchTerm.trim()) {
      url = `${API_URL}/map/search?q=${encodeURIComponent(searchTerm)}&lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=10`;
    } else {
      url = `${API_URL}/map/pins?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=10`;
    }

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token || ""}` },
    });
    if (!mountedRef.current) return;

    if (searchTerm && searchTerm.trim()) {
      // Search results - don't cache these
      const results = response.data.results || [];

      // Process results to add full URLs
      const processedResults = results.map((post: any) => {
        const fullUrl = fixUrl(post.media_url || post.image_url);
        return {
          ...post,
          full_image_url: fullUrl,
          full_thumbnail_url: fixUrl(post.thumbnail_url),
        };
      });

      setMapPosts(processedResults);
      setMapRestaurants([]);
    } else {
      // All pins - cache these
      const posts = response.data.posts || [];
      const restaurants = response.data.restaurants || [];

      // Process posts to add full URLs
      const processedPosts = posts.map((post: any) => {
        const fullUrl = fixUrl(post.media_url || post.image_url);
        const thumbnailUrl = fixUrl(post.thumbnail_url);
        return {
          ...post,
          full_image_url: fullUrl,
          full_thumbnail_url: thumbnailUrl,
        };
      });

      // Cache the processed posts
      cachedMapPosts.current = processedPosts;

      setMapPosts(processedPosts);
      setMapRestaurants(restaurants);
    }
  } catch (error) {
    if (!mountedRef.current) return;
  } finally {
    if (mountedRef.current) setMapLoading(false);
  }
};

// Fetch followers posts for map with caching (NO RADIUS LIMIT - worldwide)
const fetchFollowersPosts = async (forceRefresh = false) => {
  if (!userLocation) {
    return;
  }

  // If we have cached followers posts and not forcing refresh, use cache
  if (!forceRefresh && cachedFollowersPosts.current.length > 0) {
    setMapPosts(cachedFollowersPosts.current);
    return;
  }

  setMapLoading(true);
  try {
    // No radius limit for followers - show all worldwide
    const url = `${API_URL}/map/followers-posts?lat=${userLocation.latitude}&lng=${userLocation.longitude}`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token || ""}` },
    });
    if (!mountedRef.current) return;

    const posts = response.data.posts || [];
    const followingCount = response.data.following_count || 0;

    // Process posts to add full URLs
    const processedPosts = posts.map((post: any) => {
      const fullUrl = fixUrl(post.media_url || post.image_url);
      return {
        ...post,
        full_image_url: fullUrl,
        full_thumbnail_url: fixUrl(post.thumbnail_url),
      };
    });

    // Cache the processed followers posts
    cachedFollowersPosts.current = processedPosts;

    setMapPosts(processedPosts);
    setMapRestaurants([]); // Clear restaurants when showing followers
  } catch (error) {
    if (!mountedRef.current) return;
    console.error("❌ Fetch followers posts error:", error);
    // If there's an error, clear the map posts
    setMapPosts([]);
    setMapRestaurants([]);
  } finally {
    if (mountedRef.current) setMapLoading(false);
  }
};

// Fetch analytics for restaurant dashboard
const fetchAnalytics = async () => {
  if (accountType !== 'restaurant' || !token) return;

  setDashboardLoading(true);
  try {
    const response = await axios.get(`${API_URL}/restaurant/analytics`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!mountedRef.current) return;

    setAnalytics({
      total_posts: response.data.total_posts || 0,
      followers_count: response.data.followers_count || 0,
      customer_reviews: response.data.customer_reviews || 0,
      profile_views: response.data.profile_views || 0,
      profile_views_trend: response.data.profile_views_trend || '',
      profile_visits: response.data.profile_visits || 0,
      profile_visits_trend: response.data.profile_visits_trend || '',
      search_appearances: response.data.search_appearances || 0,
      search_appearances_trend: response.data.search_appearances_trend || '',
      post_clicks: response.data.post_clicks || 0,
      post_clicks_trend: response.data.post_clicks_trend || '',
    });
  } catch (error) {
    if (!mountedRef.current) return;
    console.error('Error fetching analytics:', error);
  } finally {
    if (mountedRef.current) setDashboardLoading(false);
  }
};

const handleQuickCategoryPress = (category: any) => {
  if (selectedQuickCategory === category.id) {
    // Deselect - show all cached posts (NO API CALL)
    setSelectedQuickCategory(null);
    if (activeTab === 'map') {
      // Use appropriate cache based on filter type
      const cacheToUse = mapFilterType === 'followers' ? cachedFollowersPosts.current : cachedMapPosts.current;
      setMapPosts(cacheToUse);
    } else {
      setAppliedCategories([]);
      setSelectedCategories([]);
      fetchPosts(true, []);
    }
  } else {
    // Select - filter from cached posts (NO API CALL)
    setSelectedQuickCategory(category.id);
    if (activeTab === 'map') {
      // Filter from appropriate cache based on filter type
      const cacheToUse = mapFilterType === 'followers' ? cachedFollowersPosts.current : cachedMapPosts.current;
      const filteredPosts = cacheToUse.filter((post: any) => {
  const postCategory = post.category?.toLowerCase().trim();
  const selectedCategoryName = category.name.toLowerCase().trim();
  // Strict match only - exact category or exact substring
  return postCategory === selectedCategoryName;
});
      setMapPosts(filteredPosts);
    } else {
      setAppliedCategories([category.name]);
      setSelectedCategories([category.name]);
      fetchPosts(true, [category.name]);
    }
  }
};

  // Handle map filter type changes
  const handleMapFilterChange = async (newFilterType: 'posts' | 'restaurants' | 'followers') => {
    setMapFilterType(newFilterType);

    // Clear quick category selection when changing filter type
    setSelectedQuickCategory(null);

    if (newFilterType === 'followers') {
      // Fetch followers posts (will use cache if available)
      await fetchFollowersPosts();
    } else if (newFilterType === 'posts') {
      // Restore cached regular posts
      if (cachedMapPosts.current.length > 0) {
        setMapPosts(cachedMapPosts.current);
        // Restaurants are already loaded from initial fetch
      } else {
        // Fetch if no cache
        await fetchMapPins(undefined, true);
      }
    } else if (newFilterType === 'restaurants') {
      // Just show restaurants (already loaded from initial fetch)
      // No need to fetch again
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

  const handleClusterPress = (cluster: any) => {
  // Sort posts by latest uploaded first
  const sortedPosts = [...cluster.posts].sort((a: any, b: any) =>
    (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime())
  );
  router.push({
    pathname: "/location-posts",
    params: {
      posts: JSON.stringify(sortedPosts),
      locationName: cluster.locationName,
    },
  });
};

  const handleViewRestaurantProfile = async (restaurant: any) => {
  setShowRestaurantModal(false);
  
  // Track profile view for restaurant
  try {
    const token = await AsyncStorage.getItem('token');
    axios.post(`${API_URL}/restaurant/analytics/track`, {
      restaurant_id: restaurant.id,
      event_type: 'profile_view'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});

    // Also track profile visit
    axios.post(`${API_URL}/restaurant/analytics/track`, {
      restaurant_id: restaurant.id,
      event_type: 'profile_visit'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  } catch (err) {
  }

  router.push(`/profile?userId=${restaurant.id}`);
};

  const handleViewPost = async (post: any) => {
  setShowPostModal(false);
  
  // Track if it's a restaurant post
  if (post.account_type === 'restaurant' || post.restaurant_id) {
    try {
      const token = await AsyncStorage.getItem('token');
      axios.post(`${API_URL}/restaurant/analytics/track`, {
        restaurant_id: post.restaurant_id || post.user_id,
        event_type: 'post_click',
        post_id: post.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    } catch (err) {
    }
  }

  router.push(`/post-details/${post.id}`);
};

  // ======================================================
  // INITIALIZE MAP/DASHBOARD WHEN TAB CHANGES
  // ======================================================
// Remove initialMapLoadDone state, we don't need it
useEffect(() => {
  const loadMapData = async () => {
    // Only proceed if we're on map tab
    if (activeTab !== 'map') return;

    // For restaurant users, fetch analytics instead of map data
    if (accountType === 'restaurant') {
      fetchAnalytics();
      return;
    }

    // If we don't have location, get it first
    if (!userLocation) {
      const coords = await getCurrentLocation();
      // fetchMapPins will be called by the next useEffect run when userLocation updates
      return;
    }

    // We have location - check if we need to fetch posts
    // Only fetch if cache is empty (first time load)
    if (cachedMapPosts.current.length === 0 && mapPosts.length === 0) {
      await fetchMapPins(undefined, true); // Force refresh
    }
    // Otherwise, data is already in mapPosts or will be restored from cache
  };

  loadMapData();
}, [activeTab, userLocation, accountType]);

useFocusEffect(
  useCallback(() => {
    
    // When returning to this screen and map tab is active
    if (activeTab === 'map' && userLocation) {
      // Determine which cache to use based on filter type
      const cacheToUse = mapFilterType === 'followers' ? cachedFollowersPosts.current : cachedMapPosts.current;

      if (mapPosts.length === 0 && cacheToUse.length > 0) {
        // Cache exists but mapPosts is empty (returned from navigation)
        if (selectedQuickCategory) {
          // Re-apply category filter from cache
          const category = QUICK_CATEGORIES.find(c => c.id === selectedQuickCategory);
          if (category) {
            const filteredPosts = cacheToUse.filter((post: any) => {
  const postCategory = post.category?.toLowerCase().trim();
  const selectedCategoryName = category.name.toLowerCase().trim();
  return postCategory === selectedCategoryName;
});
            setMapPosts(filteredPosts);
          } else {
            setMapPosts(cacheToUse);
          }
        } else {
          setMapPosts(cacheToUse);
        }
      } else if (cacheToUse.length === 0) {
        // No cache exists, need to fetch
        if (mapFilterType === 'followers') {
          fetchFollowersPosts(true);
        } else {
          fetchMapPins(undefined, true);
        }
      }
      // If mapPosts.length > 0, do nothing - data already there
    }
    
    // Users tab logic
    if (user && token && activeTab === 'users' && posts.length === 0) {
      fetchPosts(true);
    }
    
    return () => setPlayingVideos([]);
  }, [activeTab, userLocation, selectedQuickCategory, user, token])
);

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
    const newPlaying = visible.slice(0, MAX_CONCURRENT_VIDEOS);
    setPlayingVideos((prev) => {
      if (prev.length === newPlaying.length && prev.every((id, i) => id === newPlaying[i])) return prev;
      return newPlaying;
    });
  }, [posts]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    scrollYRef.current = contentOffset.y;
    calculateVisibleVideos(contentOffset.y);
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - SCREEN_HEIGHT * 3) {
      if (hasMore && !loadingMore && !loading) fetchPosts(false);
    }
  }, [calculateVisibleVideos, hasMore, loadingMore, loading]);

  useEffect(() => {
    if (posts.length > 0) {
      const timer = setTimeout(() => calculateVisibleVideos(scrollYRef.current), 500);
      return () => clearTimeout(timer);
    }
  }, [posts.length]);

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
      if (!mountedRef.current) return;

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
          is_clicked: post.is_clicked_by_user || false,
          is_viewed: post.is_viewed_by_user || false,
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

      // Pre-fetch thumbnails for grid view (much smaller than full images)
      const postsToPreFetch = newPosts.slice(0, 6);
      postsToPreFetch.forEach((post: any) => {
        const urlToPreFetch = post.full_thumbnail_url || post.full_image_url;
        if (urlToPreFetch && !post._isVideo) {
          Image.prefetch(urlToPreFetch);
        }
      });

      if (newPosts.length < POSTS_PER_PAGE) setHasMore(false);
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("Fetch error:", err);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const fetchPostsWithCategories = (categories: string[]) => fetchPosts(true, categories);
  const getBadgeTitle = (level: number): string => {
    if (level <= 4) return 'Reviewer';
    if (level <= 8) return 'Top Reviewer';
    return 'Influencer';
  };

  const fetchTopPosts = async () => {
    setTopPostsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/posts/last-3-days`, { headers: { Authorization: `Bearer ${token || ""}` } });
      if (!mountedRef.current) return;
      setTopPosts(res.data);
    } catch (err) {
      if (!mountedRef.current) return;
    } finally {
      if (mountedRef.current) setTopPostsLoading(false);
    }
  };
  const performSearch = () => { if (searchQuery.trim()) { const q = searchQuery.trim(); setSearchQuery(''); router.push({ pathname: "/search-results", params: { query: q } }); } };
  const toggleCategory = (itemName: string) => { 
  setSelectedCategories((prev) => 
    prev.includes(itemName) 
      ? prev.filter((c) => c !== itemName) 
      : [...prev, itemName]
  ); 
};
  const handleLike = async (id: string, liked: boolean) => { setPosts((prev) => prev.map((p) => p.id === id ? { ...p, is_liked: !liked, likes_count: p.likes_count + (liked ? -1 : 1) } : p)); try { liked ? await unlikePost(id) : await likePost(id); } catch {} };
  const handleView = async (postId: string) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, views_count: (p.views_count || 0) + 1, is_viewed: true } : p));
    try {
      await AsyncStorage.getItem('token');
    } catch {}
  };
  const onRefresh = useCallback(() => { setRefreshing(true); setPlayingVideos([]); fetchPosts(true); }, [appliedCategories]);
  const handlePostPressGrid = async (postId: string) => {
  setPlayingVideos([]);

  const post = posts.find(p => p.id === postId);

  // Only count click if this user hasn't clicked this post before
  if (post && !post.is_clicked) {
    // Optimistically increment clicks_count and mark as clicked
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, clicks_count: (p.clicks_count || 0) + 1, is_clicked: true } : p));

    // Track click on backend
    try {
      const tkn = await AsyncStorage.getItem('token');
      axios.post(`${API_URL}/posts/${postId}/click`, {}, {
        headers: { Authorization: `Bearer ${tkn}` }
      }).catch(() => {});
    } catch (err) {
    }
  }

  // Also track restaurant analytics if applicable
  if (post && post.account_type === 'restaurant') {
    try {
      const tkn = await AsyncStorage.getItem('token');
      axios.post(`${API_URL}/restaurant/analytics/track`, {
        restaurant_id: post.user_id,
        event_type: 'post_click',
        post_id: postId
      }, {
        headers: { Authorization: `Bearer ${tkn}` }
      }).catch(() => {});
    } catch (err) {
    }
  }

  router.push(`/post-details/${postId}`);
};

  const columns = React.useMemo(() => distributePosts(posts), [posts]);

  if (!user || !token) return <View style={styles.center}><ActivityIndicator size="large" color="#4dd0e1" /><Text>Authenticating…</Text></View>;

return (
  <View style={styles.container}>
    <View style={styles.headerContainer}>
      {/* GRADIENT HEADER REMOVED - START DIRECTLY WITH SEARCH */}

      {/* Search Box and Categories - Hidden for restaurant users and Top tab */}
      {accountType !== 'restaurant' && activeTab !== 'topPosts' && (
        <>
          {/* Search Box - Now at the top */}
          <View style={styles.searchBoxWrapper}>
            <View style={styles.searchBox}>
              <TouchableOpacity onPress={performSearch} activeOpacity={0.7}>
                <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
              </TouchableOpacity>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <TextInput
                  style={styles.searchInput}
                  placeholder=""
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  onSubmitEditing={performSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {!searchQuery && !searchFocused && (
                  <View style={styles.animatedPlaceholder} pointerEvents="none">
                    <Text style={styles.animatedPlaceholderStatic}>Search for </Text>
                    <Text style={styles.animatedPlaceholderTyping}>{placeholderText}</Text>
                    <Text style={styles.animatedPlaceholderCursor}>|</Text>
                  </View>
                )}
              </View>

              {/* UPDATED CATEGORY BUTTON - NEW BRAND COLORS */}
              <TouchableOpacity onPress={() => setShowCategoryModal(true)} activeOpacity={0.8}>
                <LinearGradient
                  colors={["#FF2E2E", "#FF7A18"]}  // NEW BRAND COLORS
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.categoryButtonGradient}
                >
                  <Text style={styles.categoryButtonEmoji}>🍽️</Text>
                  <Text style={styles.categoryButtonText}>
                    {appliedCategories.length > 0 ? `${appliedCategories.length} selected` : "Category"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
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
                {renderCategoryIcon(category.emoji, 13, 4)}
                <Text style={[
                  styles.quickCategoryText,
                  selectedQuickCategory === category.id && styles.quickCategoryTextActive
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* TOP POSTS | DASHBOARD/MAP | USERS TOGGLE */}
<View style={styles.toggleContainer}>
  <View style={styles.toggleBackground}>
    <TouchableOpacity
      style={[styles.toggleTab, activeTab === 'topPosts' && styles.toggleTabActive]}
      onPress={() => {
        if (activeTab !== 'topPosts') {
          setActiveTab('topPosts');
          setPlayingVideos([]);
          fetchTopPosts();
        }
      }}
    >
      <Ionicons
        name="camera"
        size={16}
        color={activeTab === 'topPosts' ? '#E94A37' : '#999'}
        style={{ marginRight: 6 }}
      />
      <Text style={[styles.toggleTabText, activeTab === 'topPosts' && styles.toggleTabTextActive]}>
        Top
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.toggleTab, activeTab === 'map' && styles.toggleTabActive]}
      onPress={() => {
        if (activeTab !== 'map') {
          setActiveTab('map');
          setPlayingVideos([]);
          if (accountType === 'restaurant') {
            fetchAnalytics();
          }
        }
      }}
    >
      <Ionicons
        name={accountType === 'restaurant' ? "analytics" : "location"}
        size={16}
        color={activeTab === 'map' ? '#E94A37' : '#999'}
        style={{ marginRight: 6 }}
      />
      <Text style={[styles.toggleTabText, activeTab === 'map' && styles.toggleTabTextActive]}>
        {accountType === 'restaurant' ? 'Dashboard' : 'Map'}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.toggleTab, activeTab === 'users' && styles.toggleTabActive]}
      onPress={() => {
        if (activeTab !== 'users') {
          setActiveTab('users');
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
</View>

      {/* USERS TAB: Category Tags - Hidden for restaurant users */}
      {accountType !== 'restaurant' && activeTab === 'users' && appliedCategories.length > 0 && (
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
  setSelectedQuickCategory(null);
  if (activeTab === 'map') {
    // Use appropriate cache based on filter type
    const cacheToUse = mapFilterType === 'followers' ? cachedFollowersPosts.current : cachedMapPosts.current;
    setMapPosts(cacheToUse);
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
      {activeTab === 'topPosts' ? (
        // TOP POSTS VIEW
        topPostsLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#E94A37" /><Text>Loading top posts...</Text></View>
        ) : topPosts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No posts in the last 2 days</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          >
            {/* Section Header */}
            <View style={styles.topPostsSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <MaskedView maskElement={<MaterialCommunityIcons name="check-decagram" size={22} color="#000" />}>
                  <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 22, height: 22 }} />
                </MaskedView>
                <Text style={styles.topPostsSectionTitle}>COFAU'S TOP PICKS</Text>
                <TouchableOpacity onPress={() => setShowTopPostsInfo(true)} style={{ marginLeft: 6 }}>
                  <Ionicons name="information-circle-outline" size={18} color="#aaa" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Info Popup */}
            <Modal
              visible={showTopPostsInfo}
              transparent
              animationType="fade"
              onRequestClose={() => setShowTopPostsInfo(false)}
            >
              <TouchableOpacity
                style={styles.infoModalOverlay}
                activeOpacity={1}
                onPress={() => setShowTopPostsInfo(false)}
              >
                <View style={styles.infoModalBox}>
                  {/* Title */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <Ionicons name="trophy" size={20} color="#F2CF68" />
                    <Text style={styles.infoModalTitle}>How It Works</Text>
                  </View>

                  {/* Description */}
                  <Text style={styles.infoModalDesc}>
                    We showcase the best food photos uploaded in the last 2 days. Every post is scored based on two factors:
                  </Text>

                  {/* Scoring Breakdown */}
                  <View style={styles.infoModalRow}>
                    <Ionicons name="camera-outline" size={16} color="#E94A37" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.infoModalLabel}>Photo Quality (60%)</Text>
                      <Text style={styles.infoModalSubtext}>How well-composed, clear, and appetising your photo looks.</Text>
                    </View>
                  </View>

                  <View style={styles.infoModalRow}>
                    <Ionicons name="heart-outline" size={16} color="#E94A37" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.infoModalLabel}>Engagement (40%)</Text>
                      <Text style={styles.infoModalSubtext}>Likes and interactions your post receives from the community.</Text>
                    </View>
                  </View>

                  {/* Fair Play Note */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, backgroundColor: '#FFF8F0', padding: 10, borderRadius: 8 }}>
                    <Ionicons name="sparkles" size={16} color="#FF7A18" style={{ marginTop: 1 }} />
                    <Text style={[styles.infoModalSubtext, { marginLeft: 8, flex: 1, color: '#555' }]}>
                      Top influencers and new uploaders are given equal opportunity — great photography always wins!
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Hero Card - Rank #1 */}
            <TouchableOpacity
              onPress={() => router.push(`/post-details/${topPosts[0].id}`)}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#FF2E2E', '#FF7A18']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCardBorder}
              >
                <View style={styles.heroCardInner}>
                  <HeroConfetti />
                  {/* Rank badge */}
                  <LinearGradient
                    colors={['#FF8A80', '#FFB74D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.heroRankBadge}
                  >
                    <Text style={styles.heroRankText}>#1</Text>
                  </LinearGradient>

                  {/* User info row */}
                  <TouchableOpacity
                    style={styles.heroUserRow}
                    onPress={() => router.push(`/profile?userId=${topPosts[0].user_id}`)}
                    activeOpacity={0.7}
                  >
                    <UserAvatar
                      profilePicture={topPosts[0].user_profile_picture}
                      username={topPosts[0].username}
                      size={48}
                      showLevelBadge={true}
                      level={topPosts[0].user_level}
                      style={undefined}
                    />
                    <View style={styles.heroUserInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.heroUsername} numberOfLines={1}>
                          {topPosts[0].username}
                        </Text>
                        {topPosts[0].user_badge === 'verified' && <CofauVerifiedBadge size={16} />}
                      </View>
                      <Text style={styles.heroBadgeTitle}>
                        {getBadgeTitle(topPosts[0].user_level)}
                      </Text>
                      <View style={styles.heroUserStats}>
                        <Text style={styles.heroStatText}>
                          {topPosts[0].user_posts_count ?? '—'} posts
                        </Text>
                        <View style={styles.heroStatDot} />
                        <Text style={styles.heroStatText}>
                          {topPosts[0].user_followers_count ?? '—'} followers
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Large Image Preview */}
                  <View style={styles.heroImageWrapper}>
                    <Image
                      source={{ uri: fixUrl(topPosts[0].image_url || topPosts[0].media_url || topPosts[0].thumbnail_url) || undefined }}
                      style={styles.heroImageBlur}
                      contentFit="cover"
                      blurRadius={30}
                    />
                    <Image
                      source={{ uri: fixUrl(topPosts[0].image_url || topPosts[0].media_url || topPosts[0].thumbnail_url) || undefined }}
                      style={styles.heroImageFront}
                      contentFit="contain"
                      placeholder={{ blurhash: BLUR_HASH }}
                    />
                  </View>

                  {/* Score Bar */}
                  <View style={styles.heroScoreRow}>
                    <View style={styles.heroScoreItem}>
                      <Ionicons name="star" size={14} color="#F2CF68" />
                      <Text style={styles.heroScoreLabel}>Quality</Text>
                      <Text style={styles.heroScoreValue}>{Math.round(topPosts[0].quality_score)}</Text>
                    </View>
                    <View style={styles.heroScoreDivider} />
                    <View style={styles.heroScoreItem}>
                      <MaskedView maskElement={<Ionicons name="heart" size={14} color="#000" />}>
                        <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 14, height: 14 }} />
                      </MaskedView>
                      <Text style={styles.heroScoreLabel}>Likes</Text>
                      <Text style={styles.heroScoreValue}>{topPosts[0].likes_count}</Text>
                    </View>
                    <View style={styles.heroScoreDivider} />
                    <View style={styles.heroScoreItem}>
                      <Ionicons name="trophy" size={14} color="#F2CF68" />
                      <Text style={styles.heroScoreLabel}>Score</Text>
                      <Text style={styles.heroScoreValue}>{Math.round(topPosts[0].combined_score)}</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Regular Cards - Ranks 2-10 */}
            {topPosts.slice(1).map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(`/post-details/${item.id}`)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#FF2E2E', '#FF7A18']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.regularCardBorder}
                >
                  <View style={styles.regularCardInner}>
                    {/* Rank badge - corner style like hero */}
                    <LinearGradient
                      colors={['#FF8A80', '#FFB74D']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.regularRankBadge}
                    >
                      <Text style={styles.regularRankText}>#{item.rank}</Text>
                    </LinearGradient>

                    {/* Top row: User */}
                    <View style={styles.regularCardHeader}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                        onPress={() => router.push(`/profile?userId=${item.user_id}`)}
                        activeOpacity={0.7}
                      >
                        <UserAvatar
                          profilePicture={item.user_profile_picture}
                          username={item.username}
                          size={32}
                          showLevelBadge={true}
                          level={item.user_level}
                          style={undefined}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
                          <Text style={styles.regularUsername} numberOfLines={1}>{item.username}</Text>
                          {item.user_badge === 'verified' && <CofauVerifiedBadge size={12} />}
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Image Preview - same as hero */}
                    <View style={styles.regularImageWrapper}>
                      <Image
                        source={{ uri: fixUrl(item.image_url || item.media_url || item.thumbnail_url) || undefined }}
                        style={styles.regularImageBlur}
                        contentFit="cover"
                        blurRadius={30}
                      />
                      <Image
                        source={{ uri: fixUrl(item.image_url || item.media_url || item.thumbnail_url) || undefined }}
                        style={styles.regularImageFront}
                        contentFit="contain"
                        placeholder={{ blurhash: BLUR_HASH }}
                      />
                    </View>

                    {/* Scores row */}
                    <View style={styles.regularScoresRow}>
                      <View style={styles.regularScoreItem}>
                        <Ionicons name="star" size={13} color="#F2CF68" />
                        <Text style={styles.regularScoreLabel}>Quality</Text>
                        <Text style={styles.regularScoreValue}>{Math.round(item.quality_score)}<Text style={styles.regularScoreMax}>/100</Text></Text>
                      </View>
                      <View style={styles.regularScoreDividerV} />
                      <View style={styles.regularScoreItem}>
                        <MaskedView maskElement={<Ionicons name="heart" size={13} color="#000" />}>
                          <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 13, height: 13 }} />
                        </MaskedView>
                        <Text style={styles.regularScoreLabel}>Engagement</Text>
                        <Text style={styles.regularScoreValue}>{Math.round(item.engagement_score)}<Text style={styles.regularScoreMax}>/100</Text></Text>
                      </View>
                      <View style={styles.regularScoreDividerV} />
                      <View style={styles.regularScoreItem}>
                        <Ionicons name="trophy" size={13} color="#F2CF68" />
                        <Text style={[styles.regularScoreLabel, { fontWeight: '700' }]}>Total</Text>
                        <Text style={[styles.regularScoreValue, { fontWeight: '700', color: '#E94A37' }]}>{Math.round(item.combined_score)}<Text style={styles.regularScoreMax}>/100</Text></Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : activeTab === 'map' ? (
  // DASHBOARD VIEW for restaurant users, MAP VIEW for regular users
  accountType === 'restaurant' ? (
    <DashboardContent
      analytics={analytics}
      loading={dashboardLoading}
      onRefresh={fetchAnalytics}
    />
  ) : (
    <MapViewComponent
      userLocation={userLocation}
      restaurants={mapRestaurants}
      posts={mapPosts}
      onRestaurantPress={handleRestaurantPress}
      onPostPress={handlePostPress}
      onClusterPress={handleClusterPress}
      isLoading={mapLoading}
      mapRef={mapRef}
      filterType={mapFilterType}
      onFilterChange={handleMapFilterChange}
      onCenterLocation={centerOnUserLocation}
      selectedCategory={selectedQuickCategory ? QUICK_CATEGORIES.find(c => c.id === selectedQuickCategory)?.name : null}
    />
  )
) : (
        // USERS GRID VIEW
        <>
          {loading && posts.length === 0 ? (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.masonryContainer}>
                {[0, 1, 2].map((col) => (
                  <View key={col} style={styles.column}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={{ width: '100%', height: COLUMN_WIDTH * (1 + (i % 3) * 0.3), borderRadius: 12, backgroundColor: '#F0F0F0', marginBottom: SPACING }} />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4dd0e1" />}>
              <View style={styles.masonryContainer}>
                {columns.map((column, columnIndex) => (
                  <View key={columnIndex} style={styles.column}>
                    {column.map((item) => <GridTile key={item.id} item={item} onPress={handlePostPressGrid} onLike={handleLike} onVideoLayout={handleVideoLayout} playingVideos={playingVideos} onView={handleView} />)}
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

      {/* CATEGORY MODAL - Hidden for restaurant users */}
      {accountType !== 'restaurant' && (
      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => { setSelectedCategories(appliedCategories); setShowCategoryModal(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <View style={styles.categoryModalHeader}>
              <Text style={styles.categoryModalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => { setSelectedCategories(appliedCategories); setShowCategoryModal(false); }}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            {selectedCategories.length > 0 && <View style={styles.selectedCountContainer}><Text style={styles.selectedCountText}>{selectedCategories.length} categories selected</Text><TouchableOpacity onPress={() => setSelectedCategories([])}><Text style={styles.clearAllModalText}>Clear All</Text></TouchableOpacity></View>}
            <FlatList 
  data={CATEGORIES} 
  keyExtractor={(item) => item.id} 
  renderItem={({ item }) => {
    const isSelected = item.name === "All" 
      ? selectedCategories.length === 0 
      : selectedCategories.includes(item.name);
    
    return (
      <TouchableOpacity 
        style={[styles.categoryItem, isSelected && styles.categoryItemSelected]} 
        onPress={() => { 
          if (item.name === "All") {
            setSelectedCategories([]);
            setShowCategoryModal(false);
            setAppliedCategories([]);
            setSelectedQuickCategory(null);
            if (activeTab === 'map') {
              // Use appropriate cache based on filter type
              const cacheToUse = mapFilterType === 'followers' ? cachedFollowersPosts.current : cachedMapPosts.current;
              setMapPosts(cacheToUse);
            } else {
              fetchPostsWithCategories([]);
            }
          } else {
            toggleCategory(item.name); 
          }
        }}
      >
        <View style={styles.categoryItemContent}>
          <View style={styles.categoryEmoji}>{renderCategoryIcon(item.emoji, 18)}</View>
          <Text style={[styles.categoryItemText, isSelected && styles.categoryItemTextSelected]}>
            {item.name}
          </Text>
        </View>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
        ) : (
          <Ionicons name="ellipse-outline" size={20} color="#CCC" />
        )}
      </TouchableOpacity>
    );
  }} 
            contentContainerStyle={styles.categoryList} />
            <View style={styles.modalFooter}>
             <TouchableOpacity
  style={styles.doneButton}
  onPress={() => {
    setAppliedCategories(selectedCategories);
    setShowCategoryModal(false);

    if (activeTab === 'map') {
  // For map tab - filter from appropriate cache based on filter type
  const cacheToUse = mapFilterType === 'followers' ? cachedFollowersPosts.current : cachedMapPosts.current;
  if (selectedCategories.length > 0) {
    const filteredPosts = cacheToUse.filter((post: any) => {
      const postCategory = post.category?.toLowerCase().trim();
      return selectedCategories.some(cat =>
        postCategory === cat.toLowerCase().trim()
      );
    });
    setMapPosts(filteredPosts);
  } else {
    // No filter - show all cached posts
    setMapPosts(cacheToUse);
  }
} else {
  // For users tab - fetch filtered posts from API
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
      )}

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

      <TopPostsModal
        visible={showTopPostsModal}
        posts={topPosts}
        loading={topPostsLoading}
        onClose={() => setShowTopPostsModal(false)}
        onViewPost={(post: any) => {
          setShowTopPostsModal(false);
          router.push(`/post-details/${post.id}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  headerContainer: { 
    position: "relative", 
    marginBottom: 0,  // Reduced from 30 since no gradient
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 35,  // Add safe area padding
  },
  
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
 
  searchBoxWrapper: { 
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: { 
    backgroundColor: "#fff", 
    borderRadius: 25, 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    flexDirection: "row", 
    alignItems: "center", 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.5, 
    shadowRadius: 12, 
    elevation: 12 
  },
  
  searchIcon: { 
    marginRight: 10 
  },
  
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333"
  },
  animatedPlaceholder: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  animatedPlaceholderStatic: {
    fontSize: 14,
    color: '#999',
  },
  animatedPlaceholderTyping: {
    fontSize: 14,
    color: '#E94A37',
    fontWeight: '600' as const,
  },
  animatedPlaceholderCursor: {
    fontSize: 14,
    color: '#E94A37',
    fontWeight: '300' as const,
    marginLeft: 1,
  },
  inlineFilterButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#E94A37", borderRadius: 18, paddingVertical: 5, paddingHorizontal: 12, gap: 4 },
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
  clicksBadge: { position: "absolute", top: 6, right: 6, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, gap: 2 },
  clicksText: { color: "#fff", fontSize: 8, fontWeight: "600" },
  topPostsButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5E6", borderRadius: 22, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#F2CF68" },
  topPostsButtonText: { fontSize: 13, fontWeight: "600", color: "#E94A37" },
  topPostsModal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%", minHeight: 400 },
  topPostsModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#E5E5E5" },
  topPostsModalTitle: { fontSize: 20, fontWeight: "bold", color: "#000", marginLeft: 8 },
  topPostsModalSubtitle: { fontSize: 13, color: "#999", fontWeight: "500" },
  topPostItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9F9F9", borderRadius: 12, padding: 12, marginBottom: 10 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E94A37", justifyContent: "center", alignItems: "center", marginRight: 10 },
  rankText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  topPostThumbnail: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  topPostInfo: { flex: 1 },
  topPostUsername: { fontSize: 14, fontWeight: "600", color: "#333" },

  // ======================================================
  // REDESIGNED TOP POSTS STYLES
  // ======================================================
  topPostsSectionHeader: {
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  topPostsSectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#333',
    marginLeft: 8,
  },
  topPostsSectionSubtitle: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '500' as const,
    marginTop: 2,
  },
  scoringExplainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
    gap: 4,
  },
  scoringExplainerText: {
    fontSize: 10,
    color: '#aaa',
    fontStyle: 'italic' as const,
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  infoModalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    marginHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  infoModalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#333',
    marginLeft: 8,
  },
  infoModalDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 14,
  },
  infoModalRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 10,
    paddingLeft: 2,
  },
  infoModalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#333',
  },
  infoModalSubtext: {
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
    marginTop: 1,
  },
  infoModalText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 8,
  },
  heroCardBorder: {
    borderRadius: 16,
    padding: 2.5,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  heroCardInner: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden' as const,
  },
  heroRankBadge: {
    position: 'absolute' as const,
    top: -1,
    left: -1,
    width: 44,
    height: 44,
    borderTopLeftRadius: 14,
    borderBottomRightRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1,
  },
  heroRankText: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#333',
  },
  heroUserRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    marginLeft: 40,
  },
  heroUserInfo: {
    marginLeft: 12,
    flex: 1,
  },
  heroUsername: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#333',
  },
  heroBadgeTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#E94A37',
    marginTop: 1,
  },
  heroUserStats: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 3,
  },
  heroStatText: {
    fontSize: 12,
    color: '#888',
  },
  heroStatDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#ccc',
    marginHorizontal: 6,
  },
  heroImageWrapper: {
    width: 'auto' as any,
    height: 200,
    marginHorizontal: -16,
    marginBottom: 12,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  heroImageBlur: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroImageFront: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroScoreRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    alignItems: 'center' as const,
  },
  heroScoreItem: {
    alignItems: 'center' as const,
    gap: 2,
  },
  heroScoreLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500' as const,
  },
  heroScoreValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#333',
  },
  heroScoreDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E5E5',
  },
  regularCardBorder: {
    borderRadius: 12,
    padding: 2,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  regularCardInner: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
  },
  regularCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
    marginLeft: 36,
  },
  regularRankBadge: {
    position: 'absolute' as const,
    top: -1,
    left: -1,
    width: 38,
    height: 38,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1,
  },
  regularRankText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  regularUsername: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#333',
    marginLeft: 8,
    flexShrink: 1,
  },
  regularImageWrapper: {
    width: 'auto' as any,
    height: 200,
    marginHorizontal: -12,
    marginBottom: 10,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  regularImageBlur: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  regularImageFront: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  regularScoresRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    alignItems: 'center' as const,
  },
  regularScoreItem: {
    alignItems: 'center' as const,
    gap: 2,
  },
  regularScoreDividerV: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E5E5',
  },
  regularScoreLabel: {
    fontSize: 11,
    color: '#555',
  },
  regularScoreValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#333',
  },
  regularScoreMax: {
    fontSize: 10,
    fontWeight: '400' as const,
    color: '#aaa',
  },

  viewsContainer: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  viewsText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  dishNameTag: { position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(233, 74, 55, 0.85)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, maxWidth: "75%" },
  dishNameText: { color: "#fff", fontSize: 9, fontWeight: "600" },
  loadingMore: { padding: 20, alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  emptyStateText: { fontSize: 18, fontWeight: "600", color: "#333", marginTop: 16 },
  navBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#E8E8E8", backgroundColor: "#FFFFFF", elevation: 8 },
  navItem: { alignItems: "center", justifyContent: "center", paddingVertical: 4, paddingHorizontal: 12 },
  navLabel: { fontSize: 11, color: "#000", marginTop: 2, textAlign: "center", fontWeight: "500" },
  navLabelActive: { fontSize: 11, color: "#000", marginTop: 2, textAlign: "center", fontWeight: "700" },
  navIconGradient: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  centerNavItem: { alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 12, marginTop: -30 },
  centerIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff", borderWidth: 2, borderColor: "#333", justifyContent: "center", alignItems: "center", marginBottom: 4, elevation: 8 },
  centerIconGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", marginBottom: 4, elevation: 8 },
  centerIconCircleInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: 'flex-end' as const },
  categoryModal: { backgroundColor: "#fff", flex: 1, marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  categoryModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E5E5" },
  categoryModalTitle: { fontSize: 17, fontWeight: "bold", color: "#000" },
  selectedCountContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#FFF5E6" },
  selectedCountText: { fontSize: 12, color: "#E94A37", fontWeight: "600" },
  clearAllModalText: { fontSize: 12, color: "#E94A37", fontWeight: "600" },
  categoryList: { padding: 8 },
  categoryItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4, backgroundColor: "#F9F9F9" },
  categoryItemSelected: { backgroundColor: "#E94A37", borderWidth: 2, borderColor: "#F2CF68" },
  categoryItemContent: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  categoryItemText: { fontSize: 14, color: "#000", flex: 1 },
  categoryItemTextSelected: { fontWeight: "600", color: "#fff" },
  modalFooter: { padding: 12, borderTopWidth: 1, borderTopColor: "#E5E5E5" },
  doneButton: { backgroundColor: "#E94A37", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  doneButtonText: { color: "#FFF", fontSize: 15, fontWeight: "bold" },

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
    bottom: 20,
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

  // Cluster Marker Styles
clusterMarkerContainer: {
  alignItems: 'center',
},
clusterPreviewContainer: {
  position: 'relative',
  height: 60,
  marginBottom: -10,
},
clusterPreviewImage: {
  width: 60,
  height: 60,
  borderRadius: 10,
  borderWidth: 3,
  borderColor: '#fff',
  backgroundColor: '#f0f0f0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
},
clusterImage: {
  width: 54,
  height: 54,
  borderRadius: 7,
},
clusterImagePlaceholder: {
  width: 54,
  height: 54,
  borderRadius: 7,
  backgroundColor: '#ccc',
  justifyContent: 'center',
  alignItems: 'center',
},
clusterRatingBadge: {
  position: 'absolute',
  bottom: 2,
  left: 2,
  right: 2,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#E94A37',
  borderRadius: 8,
  paddingVertical: 2,
  paddingHorizontal: 4,
  gap: 2,
},
clusterRatingText: {
  color: '#fff',
  fontSize: 9,
  fontWeight: 'bold',
},
clusterPinContainer: {
  alignItems: 'center',
},
clusterPin: {
  width: 40,
  height: 40,
  borderRadius: 20,
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
},
clusterPinEmoji: {
  fontSize: 18,
},
clusterPinWithEmoji: {
  backgroundColor: '#4ECDC4', // Different color when showing emoji
},
clusterCountBadge: {
  position: 'absolute',
  top: -5,
  right: -10,
  backgroundColor: '#fff',
  borderRadius: 12,
  minWidth: 24,
  height: 24,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: '#E94A37',
  paddingHorizontal: 6,
},
clusterCountText: {
  color: '#E94A37',
  fontSize: 12,
  fontWeight: 'bold',
},
clusterPinArrow: {
  width: 0,
  height: 0,
  borderLeftWidth: 8,
  borderRightWidth: 8,
  borderTopWidth: 10,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
  borderTopColor: '#fff',
  marginTop: -3,
},
// Android-specific cluster styles
androidClusterPreview: {
  width: 70,
  height: 70,
  borderRadius: 12,
  borderWidth: 3,
  borderColor: '#fff',
  backgroundColor: '#f0f0f0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5,
  marginBottom: -10,
},
androidClusterImage: {
  width: 64,
  height: 64,
  borderRadius: 9,
},
androidClusterImagePlaceholder: {
  width: 64,
  height: 64,
  borderRadius: 9,
  backgroundColor: '#ccc',
  justifyContent: 'center',
  alignItems: 'center',
},
androidGridIndicator: {
  position: 'absolute',
  top: 4,
  right: 4,
  backgroundColor: 'rgba(0,0,0,0.7)',
  borderRadius: 12,
  width: 24,
  height: 24,
  justifyContent: 'center',
  alignItems: 'center',
},

 // ======================================================
// RESTAURANT MARKER STYLES - UPDATED
// ======================================================
restaurantMarkerContainer: {
  alignItems: 'center',
},
restaurantMarkerBubble: {
  width: 80,  // Increased from 50
  height: 80, // Increased from 50
  borderRadius: 40,
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
  width: 74,
  height: 74,
  borderRadius: 37,
},
restaurantMarkerPlaceholder: {
  width: 74,
  height: 74,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#E94A37',
},
// Add to your StyleSheet:
clusterBadge: {
  position: 'absolute',
  bottom: 8,
  backgroundColor: '#E94A37',
  borderRadius: 12,
  minWidth: 24,
  height: 24,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 6,
  borderWidth: 2,
  borderColor: '#fff',
},
clusterBadgeText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
},
reviewsBadge: {
  position: 'absolute',
  bottom: 8,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#E94A37',
  borderRadius: 10,
  paddingVertical: 3,
  paddingHorizontal: 6,
  gap: 3,
  borderWidth: 1.5,
  borderColor: '#fff',
},
reviewsBadgeText: {
  color: '#fff',
  fontSize: 11,
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
categoryButtonEmoji: {
  fontSize: 18,
},
categoryButtonText: {
  fontSize: 12,
  color: '#FFF',
  fontWeight: '600',
  maxWidth: 80,
},

// ======================================================
// POST MARKER STYLES - UPDATED
// ======================================================
postMarkerContainer: {
  alignItems: 'center',
},
postMarkerBubble: {
  width: 56,
  height: 56,
  borderRadius: 8,
  backgroundColor: '#F2CF68',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2.5,
  borderColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 5,
},
postMarkerImage: {
  width: 50,
  height: 50,
  borderRadius: 6,
},
postMarkerPlaceholder: {
  width: 50,
  height: 50,
  borderRadius: 6,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#F2CF68',
},
ratingBadge: {
  position: 'absolute',
  bottom: 8,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#E94A37',
  borderRadius: 10,
  paddingVertical: 3,
  paddingHorizontal: 6,
  gap: 2,
  borderWidth: 1.5,
  borderColor: '#fff',
},
ratingBadgeText: {
  color: '#fff',
  fontSize: 11,
  fontWeight: 'bold',
},
postMarkerArrow: {
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
// Android-specific PostMarker styles with explicit sizing
postMarkerContainerAndroid: {
  alignItems: 'center',
  width: 100,
},
postMarkerBubbleAndroid: {
  width: 90,
  height: 90,
  borderRadius: 45, // Perfect circle (half of width/height)
  backgroundColor: '#F2CF68',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 3,
  borderColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.4,
  shadowRadius: 5,
  elevation: 6,
},
postMarkerImageAndroid: {
  width: 84,
  height: 84,
  borderRadius: 42, // Perfect circle (half of width/height)
},
postMarkerPlaceholderAndroid: {
  width: 84,
  height: 84,
  borderRadius: 42, // Perfect circle
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#F2CF68',
},

// Android-specific ClusterMarker styles
clusterMarkerContainerAndroid: {
  alignItems: 'center',
  justifyContent: 'center',
},
clusterPreviewContainerAndroid: {
  flexDirection: 'row',
  alignItems: 'center',
  height: 70,
},
clusterImageWrapperAndroid: {
  width: 70,
  height: 70,
  borderRadius: 35, // Perfect circle (half of width/height)
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 3,
  borderColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.4,
  shadowRadius: 5,
  elevation: 6,
  overflow: 'hidden',
},
clusterImageAndroid: {
  width: 64,
  height: 64,
  borderRadius: 32, // Perfect circle (half of width/height)
},
clusterImagePlaceholderAndroid: {
  width: 64,
  height: 64,
  borderRadius: 32, // Perfect circle
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#9C27B0',
},
clusterCountBadgeAndroid: {
  position: 'absolute',
  top: -8,
  right: -8,
  backgroundColor: '#E94A37',
  borderRadius: 16,
  width: 32,
  height: 32,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 5,
},
clusterCountTextAndroid: {
  color: '#fff',
  fontSize: 13,
  fontWeight: 'bold',
},

// FLOATING MAP TOGGLE STYLES
mapFloatingToggle: {
  position: 'absolute',
  top: 12,
  right: 12,
  flexDirection: 'row',
  backgroundColor: '#F5F5F5',
  borderRadius: 25,
  padding: 4,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  elevation: 5,
},
mapToggleOption: {
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 20,
},
mapToggleOptionActive: {
  backgroundColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},
mapToggleDivider: {
  width: 1,
  height: 20,
  backgroundColor: '#ddd',
  marginHorizontal: 2,
},
mapToggleText: {
  fontSize: 12,
  fontWeight: '500',
  color: '#999',
},
mapToggleTextActive: {
  color: '#E94A37',
  fontWeight: '600',
},
locationButton: {
  position: 'absolute',
  bottom: 140,
  right: 16,
  zIndex: 100,
},
locationButtonInner: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 5,
},

// SQUAD OVERLAY
squadOverlay: {
  position: 'absolute',
  top: 60,
  left: 0,
  right: 0,
  bottom: 90,
  backgroundColor: 'rgba(255,255,255,0.95)',
  justifyContent: 'center',
  alignItems: 'center',
},
squadOverlayTitle: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#E94A37',
  marginTop: 16,
},
squadOverlayText: {
  fontSize: 16,
  color: '#E94A37',
  marginTop: 8,
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
  maxHeight: 34,
  marginBottom: 6,
  marginTop: 2,
},
quickCategoryContainer: {
  paddingHorizontal: 16,
  gap: 6,
  flexDirection: 'row',
  alignItems: 'center',
},
quickCategoryChip: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFF8F0',
  borderRadius: 14,
  paddingVertical: 4,
  paddingHorizontal: 10,
  borderWidth: 1,
  borderColor: '#F2CF68',
},
quickCategoryChipActive: {
  backgroundColor: '#E94A37',
  borderColor: '#E94A37',
},
quickCategoryEmoji: {
  fontSize: 13,
  marginRight: 4,
},
quickCategoryText: {
  fontSize: 11,
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
  alignItems: 'center' as const,
  marginBottom: 8,
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
  paddingHorizontal: 16,
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
    color: '#E94A37',
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
  categoryEmoji: {
  marginRight: 8,
  justifyContent: 'center',
  alignItems: 'center',
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

  // ======================================================
  // DASHBOARD STYLES (for restaurant users)
  // ======================================================
  dashboardLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  dashboardLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  dashboardScrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
  },
  dashboardAnalyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  dashboardAnalyticsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  dashboardAnalyticsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 20,
  },
  dashboardSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
    gap: 8,
  },
  dashboardSectionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dashboardStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  dashboardStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dashboardStatIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dashboardStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  dashboardStatLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  dashboardStatSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  dashboardLargeStatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dashboardLargeStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dashboardLargeStatIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardLargeStatInfo: {
    gap: 4,
  },
  dashboardLargeStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dashboardLargeStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  dashboardTrendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dashboardTrendText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  dashboardInfoCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F5F5',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1B7C82',
  },
  dashboardInfoContent: {
    flex: 1,
  },
  dashboardInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B7C82',
    marginBottom: 4,
  },
  dashboardInfoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});