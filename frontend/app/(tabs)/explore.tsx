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
  Easing,
  Keyboard,
  InteractionManager,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useExploreRefresh } from "./_layout";
import axios from "axios";
import { Image } from "expo-image";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { likePost, unlikePost, followUser, savePost, unsavePost } from "../../utils/api";
import UserAvatar from "../../components/UserAvatar";
import CofauVerifiedBadge from "../../components/CofauVerifiedBadge";
import HappeningPlaces from "../../components/HappeningPlaces";
import { ActiveUsersList } from "../../components/ActiveUsersList";
let MapView: any;
let Marker: any;
let Callout: any;
let Circle: any;
try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
  Circle = maps.Circle;
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
const MAX_CONCURRENT_VIDEOS = Platform.OS === 'android' ? 1 : 2;

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

const GradientText = ({ text, style }: { text: string; style: any }) => (
  <MaskedView maskElement={<Text style={[style, { backgroundColor: 'transparent' }]}>{text}</Text>}>
    <LinearGradient colors={["#FF2E2E", "#FF7A18"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <Text style={[style, { opacity: 0 }]}>{text}</Text>
    </LinearGradient>
  </MaskedView>
);

const GradientIcon = ({ name, size = 16 }: { name: any; size?: number }) => (
  <MaskedView maskElement={<Ionicons name={name} size={size} color="#000" />}>
    <LinearGradient colors={["#FF2E2E", "#FF7A18"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: size, height: size }} />
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
        // Unload video to free memory on Android
        if (Platform.OS === 'android') {
          await videoRef.current.unloadAsync();
        } else {
          await videoRef.current.pauseAsync();
        }
      }
    } catch (e) {
    }
  };
  controlVideo();
  return () => {
    // Cleanup: unload video when component unmounts
    videoRef.current?.unloadAsync().catch(() => {});
  };
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
        <Ionicons name="eye" size={13} color="#fff" />
        <Text style={styles.clicksText}>{(item.clicks_count || 0) > 1000 ? `${((item.clicks_count || 0) / 1000).toFixed(1)}K` : (item.clicks_count || 0)}</Text>
      </View>
      {item.dish_name && (
        <TouchableOpacity style={styles.dishNameTag} activeOpacity={0.7} onPress={(e) => { e.stopPropagation(); tileRouter.push({ pathname: "/search-results", params: { query: item.dish_name } }); }}>
          <Text style={styles.dishNameText} numberOfLines={1}>{item.dish_name.toUpperCase()}</Text>
          <View style={styles.dishNameArrow}><Ionicons name="chevron-forward" size={8} color="#fff" /></View>
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
        <Ionicons name="eye" size={13} color="#fff" />
        <Text style={styles.clicksText}>{(item.clicks_count || 0) > 1000 ? `${((item.clicks_count || 0) / 1000).toFixed(1)}K` : (item.clicks_count || 0)}</Text>
      </View>
      {item.dish_name && (
        <TouchableOpacity style={styles.dishNameTag} activeOpacity={0.7} onPress={(e) => { e.stopPropagation(); tileRouter.push({ pathname: "/search-results", params: { query: item.dish_name } }); }}>
          <Text style={styles.dishNameText} numberOfLines={1}>{item.dish_name.toUpperCase()}</Text>
          <View style={styles.dishNameArrow}><Ionicons name="chevron-forward" size={8} color="#fff" /></View>
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
    }, Platform.OS === 'android' ? 2000 : 5000);
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

// Location Marker (one marker per restaurant/location - shows latest post photo + "X posts" badge)
const LocationMarker = memo(({ location, onPostPress, onClusterPress }: any) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTracksChanges(false), Platform.OS === 'android' ? 2000 : 5000);
    return () => clearTimeout(timer);
  }, []);

  const { latitude, longitude, posts, count } = location;
  if (!latitude || !longitude) return null;

  const latestPost = posts[0]; // already sorted newest first
  const imageUrl = latestPost?.full_thumbnail_url || latestPost?.full_image_url;
  const totalViews = posts.reduce((sum: number, p: any) => sum + (p.clicks_count || 0), 0);
  const viewDisplay = totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}K` : `${totalViews}`;

  const handlePress = () => {
    if (count === 1) {
      onPostPress(posts[0]);
    } else {
      onClusterPress(location);
    }
  };

  // Android rendering
  if (Platform.OS === 'android') {
    return (
      <Marker
        coordinate={{ latitude, longitude }}
        onPress={handlePress}
        tracksViewChanges={tracksChanges && !imageLoaded}
      >
        <View style={{ alignItems: 'center' }}>
          {/* Post count pill badge */}
          <View style={{
            backgroundColor: '#E94A37',
            borderRadius: 10,
            paddingVertical: 2,
            paddingHorizontal: 8,
            marginBottom: 4,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
              {count} {count === 1 ? 'post' : 'posts'}
            </Text>
          </View>
          {/* Photo thumbnail */}
          <View style={{ backgroundColor: '#FFFFFF', padding: 3, elevation: 5, borderRadius: 8 }}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: 56, height: 56, borderRadius: 6 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                onLoad={() => { setImageLoaded(true); setTracksChanges(false); }}
              />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 6, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="image" size={24} color="#fff" />
              </View>
            )}
            {/* View count overlay */}
            <View style={styles.markerViewsBadge}>
              <Ionicons name="eye" size={8} color="#fff" />
              <Text style={styles.markerViewsText}>{viewDisplay}</Text>
            </View>
          </View>
        </View>
      </Marker>
    );
  }

  // iOS rendering
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={(e: any) => { e?.stopPropagation?.(); handlePress(); }}
      tracksViewChanges={tracksChanges && !imageLoaded}
      zIndex={count > 1 ? 1000 + count : (latestPost?.id ? parseInt(String(latestPost.id).replace(/\D/g, '').slice(-6) || '1', 10) : 1)}
      stopPropagation={true}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={{ alignItems: 'center' }}>
        {/* Post count pill badge */}
        <View style={styles.locationPostsBadge}>
          <Text style={styles.locationPostsBadgeText}>
            {count} {count === 1 ? 'post' : 'posts'}
          </Text>
        </View>
        {/* Photo thumbnail */}
        <View style={styles.locationMarkerBubble}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.locationMarkerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <View style={styles.locationMarkerPlaceholder}>
              <Ionicons name="image" size={24} color="#fff" />
            </View>
          )}
          {/* View count overlay */}
          <View style={styles.markerViewsBadge}>
            <Ionicons name="eye" size={8} color="#fff" />
            <Text style={styles.markerViewsText}>{viewDisplay}</Text>
          </View>
        </View>
        <View style={styles.postMarkerArrow} />
      </View>
    </Marker>
  );
});

// Zoom Cluster Marker (merges nearby locations when zoomed out)
const ZoomClusterMarker = memo(({ cluster, mapRef }: any) => {
  const { latitude, longitude, locationCount, totalPosts } = cluster;
  const [tracksChanges, setTracksChanges] = useState(true);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    const timer = setTimeout(() => setTracksChanges(false), Platform.OS === 'android' ? 2000 : 3000);
    return () => clearTimeout(timer);
  }, []);

  const handlePress = () => {
    if (mapRef?.current) {
      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: cluster.spanLat * 2 || 0.02,
        longitudeDelta: cluster.spanLng * 2 || 0.02,
      }, 500);
    }
  };

  // Dynamic size based on total posts: min 40, max 80
  const size = Math.min(80, Math.max(40, 40 + Math.log2(totalPosts + 1) * 8));
  // Dynamic color: fewer posts = lighter orange, more posts = deep red
  const intensity = Math.min(1, totalPosts / 50);
  const r = Math.round(255);
  const g = Math.round(122 - intensity * 80);  // 122 → 42
  const b = Math.round(24 - intensity * 24);    // 24 → 0
  const bgColor = `rgba(${r}, ${g}, ${b}, ${0.7 + intensity * 0.3})`;
  const countDisplay = totalPosts > 99 ? '99+' : `${totalPosts}`;
  const fontSize = size > 60 ? 18 : size > 50 ? 15 : 12;
  const labelSize = size > 60 ? 9 : 7;

  // Android rendering
  if (Platform.OS === 'android') {
    return (
      <Marker
        coordinate={{ latitude, longitude }}
        onPress={handlePress}
        tracksViewChanges={tracksChanges}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.8)',
            elevation: 6 + Math.min(4, totalPosts / 10),
          }}>
            <Text style={{ color: '#fff', fontSize, fontWeight: 'bold' }}>{countDisplay}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: labelSize, fontWeight: '600' }}>posts</Text>
          </View>
        </View>
      </Marker>
    );
  }

  // iOS rendering
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={(e: any) => { e?.stopPropagation?.(); handlePress(); }}
      tracksViewChanges={tracksChanges}
      zIndex={2000 + totalPosts}
      stopPropagation={true}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: scaleAnim }] }}>
        <View style={[styles.zoomClusterBubble, {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          shadowColor: bgColor,
          shadowOpacity: 0.5,
          shadowRadius: 8,
        }]}>
          <Text style={[styles.zoomClusterCount, { fontSize }]}>{countDisplay}</Text>
          <Text style={[styles.zoomClusterLabel, { fontSize: labelSize }]}>posts</Text>
        </View>
      </Animated.View>
    </Marker>
  );
});

// Following Mode Marker (shows user DPs instead of post thumbnails)
const FollowingMarker = memo(({ location, onPress }: any) => {
  const [tracksChanges, setTracksChanges] = useState(true);
  const { users, latitude, longitude, totalUserCount } = location;

  useEffect(() => {
    const timer = setTimeout(() => setTracksChanges(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const displayUsers = users.slice(0, 3);
  const remainingUsers = totalUserCount - 3;
  const singleUser = users.length === 1;
  const singlePost = singleUser && users[0].postCount === 1;

  const renderDP = (user: any, size: number, onLoad?: () => void) => {
    const dpUrl = fixUrl(user.user_profile_picture);
    if (dpUrl) {
      return (
        <Image
          source={{ uri: dpUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onLoad={() => {
            onLoad?.();
          }}
        />
      );
    }
    const initial = user.username?.[0]?.toUpperCase() || '?';
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: size * 0.4 }}>{initial}</Text>
      </View>
    );
  };

  // Scenario 1: Single user, single post — post image with DP overlay
  if (singlePost) {
    const post = users[0].latestPost;
    const imageUrl = post.full_thumbnail_url || post.full_image_url;

    if (Platform.OS === 'android') {
      return (
        <Marker
          coordinate={{ latitude, longitude }}
          onPress={() => onPress(location)}
          tracksViewChanges={tracksChanges}
        >
          <View style={{ alignItems: 'center' }}>
            <View style={{ position: 'relative' }}>
              <View style={{ backgroundColor: '#fff', padding: 2, elevation: 5, borderRadius: 8 }}>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: 56, height: 56, borderRadius: 6 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    onLoad={() => setTracksChanges(false)}
                  />
                ) : (
                  <View style={{ width: 56, height: 56, borderRadius: 6, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="image" size={20} color="#fff" />
                  </View>
                )}
              </View>
              <View style={{ position: 'absolute', top: -6, left: -6, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff', overflow: 'hidden', elevation: 10 }}>
                {renderDP(users[0], 20)}
              </View>
            </View>
          </View>
        </Marker>
      );
    }

    // iOS
    return (
      <Marker
        coordinate={{ latitude, longitude }}
        onPress={(e: any) => { e?.stopPropagation?.(); onPress(location); }}
        tracksViewChanges={tracksChanges}
        stopPropagation={true}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={{ position: 'relative' }}>
            <View style={styles.followingPostBubble}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={{ width: 56, height: 56, borderRadius: 6 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  onLoad={() => setTracksChanges(false)}
                />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: 6, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="image" size={20} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.followingDPOverlay}>
              {renderDP(users[0], 20)}
            </View>
          </View>
          <View style={styles.followingMarkerArrow} />
        </View>
      </Marker>
    );
  }

  // Scenario 2: Single user, multiple posts — circular DP with count badge
  if (singleUser) {
    const user = users[0];

    if (Platform.OS === 'android') {
      return (
        <Marker
          coordinate={{ latitude, longitude }}
          onPress={() => onPress(location)}
          tracksViewChanges={tracksChanges}
        >
          <View style={{ alignItems: 'center' }}>
            <View style={{ position: 'relative' }}>
              <View style={{ width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#fff', overflow: 'hidden', elevation: 5 }}>
                {renderDP(user, 44, () => setTracksChanges(false))}
              </View>
              <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#E94A37', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff', elevation: 8 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{user.postCount}</Text>
              </View>
            </View>
          </View>
        </Marker>
      );
    }

    // iOS
    return (
      <Marker
        coordinate={{ latitude, longitude }}
        onPress={(e: any) => { e?.stopPropagation?.(); onPress(location); }}
        tracksViewChanges={tracksChanges}
        stopPropagation={true}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={{ position: 'relative' }}>
            <View style={styles.followingUserBubble}>
              {renderDP(user, 44, () => setTracksChanges(false))}
            </View>
            <View style={styles.followingCountBadge}>
              <Text style={styles.followingCountBadgeText}>{user.postCount}</Text>
            </View>
          </View>
          <View style={styles.followingMarkerArrow} />
        </View>
      </Marker>
    );
  }

  // Scenario 3 & 4: Multiple users — side-by-side DPs
  if (Platform.OS === 'android') {
    return (
      <Marker
        coordinate={{ latitude, longitude }}
        onPress={() => onPress(location)}
        tracksViewChanges={tracksChanges}
      >
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {displayUsers.map((user: any, index: number) => (
              <View key={user.user_id} style={{ position: 'relative', marginLeft: index === 0 ? 0 : -10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: '#fff', overflow: 'hidden', elevation: 5 + (displayUsers.length - index) }}>
                  {renderDP(user, 34, index === 0 ? () => setTracksChanges(false) : undefined)}
                </View>
                {user.postCount > 1 && (
                  <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#E94A37', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1, borderColor: '#fff', elevation: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{user.postCount}</Text>
                  </View>
                )}
              </View>
            ))}
            {remainingUsers > 0 && (
              <View style={{ backgroundColor: '#1a1a2e', borderRadius: 14, minWidth: 28, height: 28, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: -8, borderWidth: 2, borderColor: '#fff', elevation: 8 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+{remainingUsers}</Text>
              </View>
            )}
          </View>
        </View>
      </Marker>
    );
  }

  // iOS — Multiple users
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={(e: any) => { e?.stopPropagation?.(); onPress(location); }}
      tracksViewChanges={tracksChanges}
      stopPropagation={true}
      zIndex={1000 + totalUserCount}
    >
      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {displayUsers.map((user: any, index: number) => (
            <View key={user.user_id} style={{ position: 'relative', marginLeft: index === 0 ? 0 : -10, zIndex: displayUsers.length - index }}>
              <View style={[styles.followingMultiUserDP]}>
                {renderDP(user, 34, index === 0 ? () => setTracksChanges(false) : undefined)}
              </View>
              {user.postCount > 1 && (
                <View style={styles.followingSmallCountBadge}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{user.postCount}</Text>
                </View>
              )}
            </View>
          ))}
          {remainingUsers > 0 && (
            <View style={styles.followingPlusNBadge}>
              <Text style={styles.followingPlusNText}>+{remainingUsers}</Text>
            </View>
          )}
        </View>
        <View style={styles.followingMarkerArrow} />
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
  onFollowingLocationPress,
  isLoading,
  mapRef,
  filterType,
  onFilterChange,
  onCenterLocation,
  selectedCategory,
  selectedFollowingUser,
  onBackToFollowingGrid,
}: any) => {
  // Delay map mount on Android to let Google Play Services initialize
  const [mapReady, setMapReady] = React.useState(Platform.OS !== 'android');
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const timer = setTimeout(() => setMapReady(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Track current map region for zoom-based clustering
  const [currentRegion, setCurrentRegion] = React.useState<any>(null);

  // Group posts by location, then cluster locations by zoom level
  const { locations, zoomClusters, followingLocations } = React.useMemo(() => {
    // Step 1: Group all posts by location using toFixed(3) (~111m precision)
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

    const followingLocations: any[] = [];

    if (filterType === 'following' && !selectedFollowingUser) {
      // Following mode without user selected: group by location, then sub-group by user
      groups.forEach((locationPosts, key) => {
        const [lat, lng] = key.split(',').map(Number);

        const userMap = new Map<string, any[]>();
        locationPosts.forEach((post: any) => {
          const uid = post.user_id || 'unknown';
          if (!userMap.has(uid)) userMap.set(uid, []);
          userMap.get(uid)!.push(post);
        });

        const users: any[] = [];
        userMap.forEach((userPosts, userId) => {
          userPosts.sort((a: any, b: any) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
          const rep = userPosts[0];
          users.push({
            user_id: userId,
            username: rep.username || 'Unknown',
            user_profile_picture: rep.user_profile_picture || null,
            user_level: rep.user_level || 1,
            account_type: rep.account_type || 'user',
            postCount: userPosts.length,
            latestPost: rep,
            posts: userPosts,
          });
        });

        users.sort((a: any, b: any) =>
          new Date(b.latestPost.created_at || 0).getTime() -
          new Date(a.latestPost.created_at || 0).getTime()
        );

        followingLocations.push({
          id: key,
          latitude: lat,
          longitude: lng,
          locationName: locationPosts[0].location_name || 'This location',
          users,
          totalPostCount: locationPosts.length,
          totalUserCount: users.length,
        });
      });

      return { locations: [], zoomClusters: [], followingLocations };
    }

    // Step 2: Build location objects (one per restaurant/location)
    const allLocations: any[] = [];
    groups.forEach((groupPosts, key) => {
      const [lat, lng] = key.split(',').map(Number);
      groupPosts.sort((a: any, b: any) =>
        (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime())
      );
      allLocations.push({
        id: key,
        latitude: lat,
        longitude: lng,
        count: groupPosts.length,
        posts: groupPosts,
        locationName: groupPosts[0].location_name || 'This location',
      });
    });

    // Step 3: Google Maps-style visibility — show/hide based on zoom + post count
    // Skip filtering for Following mode — show all posts from followed users
    if (filterType === 'following' && selectedFollowingUser) {
      return { locations: allLocations, zoomClusters: [], followingLocations };
    }

    // Higher post count = visible even when zoomed out. Lower = only when zoomed in.
    const delta = currentRegion?.latitudeDelta || 0.05;
    let minPosts: number;
    if (delta > 0.3) minPosts = 10;       // Region view: only 10+ post locations
    else if (delta > 0.08) minPosts = 5;   // City view: 5+ post locations
    else if (delta > 0.02) minPosts = 2;   // Neighborhood: 2+ post locations
    else minPosts = 1;                      // Street level: show ALL

    const visibleLocations = allLocations.filter(loc => loc.count >= minPosts);

    // Sort by post count descending — cap visible markers to prevent clutter
    visibleLocations.sort((a: any, b: any) => b.count - a.count);
    const maxMarkers = delta > 0.3 ? 8 : delta > 0.08 ? 15 : delta > 0.02 ? 30 : 999;
    const locations = visibleLocations.slice(0, maxMarkers);

    return { locations, zoomClusters: [], followingLocations };
  }, [posts, filterType, selectedFollowingUser, currentRegion]);

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
          onRegionChangeComplete={(region: any) => setCurrentRegion(region)}
        >
          {/* Restaurant Markers */}
          {filterType === 'restaurants' && restaurants.map((restaurant: any) => (
            <RestaurantMarker
              key={`restaurant-${restaurant.id}`}
              restaurant={restaurant}
              onPress={onRestaurantPress}
            />
          ))}

          {/* Near Me / Following with user: Location Markers (one per location) */}
          {(filterType === 'posts' || (filterType === 'following' && selectedFollowingUser)) && locations.map((location: any) => (
            <LocationMarker
              key={`loc-${location.id}`}
              location={location}
              onPostPress={onPostPress}
              onClusterPress={onClusterPress}
            />
          ))}

          {/* Following without user selected: map is empty, grid overlay is shown */}
        </MapView>
        </MapErrorBoundary>
      ) : (
        <View style={styles.mapLoadingContainer}>
          <ActivityIndicator size="large" color="#E94A37" />
          <Text style={styles.mapLoadingText}>Getting your location...</Text>
        </View>
      )}

      {/* Floating Toggle */}
      <View style={styles.mapFloatingToggle}>
        <TouchableOpacity
          style={[styles.mapToggleOption, filterType === 'posts' && styles.mapToggleOptionActive]}
          onPress={() => onFilterChange('posts')}
        >
          <Text style={[styles.mapToggleText, filterType === 'posts' && styles.mapToggleTextActive]}>Near me</Text>
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
          style={[styles.mapToggleOption, filterType === 'following' && styles.mapToggleOptionActive]}
          onPress={() => onFilterChange('following')}
        >
          <Text style={[styles.mapToggleText, filterType === 'following' && styles.mapToggleTextActive]}>Following</Text>
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
            ? `${posts.length} posts at ${locations.length} locations`
            : filterType === 'restaurants'
            ? `${restaurants.length} restaurants nearby`
            : selectedFollowingUser
            ? `${posts.length} posts by ${selectedFollowingUser.username}`
            : `Select a user to view posts`
          }
        </Text>
      </View>

      {/* Location Button */}
      <LocationButton onPress={onCenterLocation} />

      {/* Back to Following Grid button */}
      {filterType === 'following' && selectedFollowingUser && (
        <TouchableOpacity
          style={styles.followingBackButton}
          onPress={onBackToFollowingGrid}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={16} color="#fff" />
          <Text style={styles.followingBackButtonText} numberOfLines={1}>
            {selectedFollowingUser.username}
          </Text>
          <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
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
              <Text style={styles.statNumber}>{restaurant.review_count || 0}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{restaurant.posts_count || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{restaurant.distance_km} km</Text>
              <Text style={styles.statLabel}>Away</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.viewProfileBtn} onPress={() => onViewProfile(restaurant)}>
            <LinearGradient
              colors={["#FF2E2E", "#FF7A18"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
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
  const [isSaved, setIsSaved] = useState(false);
  const [localSavesCount, setLocalSavesCount] = useState(0);

  useEffect(() => {
    if (post) {
      setIsSaved(post.is_saved_by_user || false);
      setLocalSavesCount(post.saves_count || 0);
    }
  }, [post]);

  const handleSave = async () => {
    if (!post) return;
    const prev = isSaved;
    setIsSaved(!prev);
    setLocalSavesCount(prev ? localSavesCount - 1 : localSavesCount + 1);
    try {
      prev ? await unsavePost(post.id) : await savePost(post.id, post.account_type);
    } catch {
      setIsSaved(prev);
      setLocalSavesCount(localSavesCount);
    }
  };

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
                  <Ionicons name="bookmark" size={14} color={isSaved ? "#FF2E2E" : "#888"} />
                  <Text style={styles.postStatText}>{localSavesCount}</Text>
                </View>
                <View style={styles.postStatItem}>
                  <Ionicons name="navigate" size={14} color="#1B7C82" />
                  <Text style={styles.postStatText}>{post.distance_km} km</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.postDetailActions}>
            <TouchableOpacity style={styles.saveActionBtn} onPress={handleSave}>
              <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={20} color={isSaved ? "#FF2E2E" : "#888"} />
              <Text style={[styles.saveActionText, isSaved && { color: '#FF9500' }]}>{isSaved ? "Saved" : "Save"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.viewProfileBtn, { flex: 1 }]} onPress={() => onViewPost(post)}>
              <LinearGradient
                colors={["#FF2E2E", "#FF7A18"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.viewProfileBtnGradient}
              >
                <Text style={styles.viewProfileBtnText}>View Full Post</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

// ======================================================
// FOLLOWING USERS AT LOCATION MODAL
// ======================================================

const FollowingUsersModal = memo(({ visible, data, onClose, onSelectUser }: any) => {
  if (!data) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.followingUsersModal}>
          {/* Header */}
          <View style={styles.followingUsersModalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.followingUsersModalTitle}>Users at this location</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="location" size={14} color="#E94A37" />
                <Text style={styles.followingUsersModalLocation} numberOfLines={1}>
                  {data.locationName}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* User List */}
          <FlatList
            data={data.users}
            keyExtractor={(item: any) => item.user_id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }: any) => (
              <TouchableOpacity
                style={styles.followingUserRow}
                onPress={() => onSelectUser(item, data.locationName)}
                activeOpacity={0.7}
              >
                {fixUrl(item.user_profile_picture) ? (
                  <Image
                    source={{ uri: fixUrl(item.user_profile_picture)! }}
                    style={styles.followingUserAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.followingUserAvatarPlaceholder}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                      {item.username?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.followingUserName} numberOfLines={1}>
                    {item.username}
                  </Text>
                  <Text style={styles.followingUserPostCount}>
                    {item.postCount} {item.postCount === 1 ? 'post' : 'posts'} here
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            )}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

// ======================================================
// FOLLOWING USERS GRID OVERLAY
// ======================================================

const GRID_COLUMNS = 4;

const FollowingUsersGrid = memo(({ visible, users, onSelectUser, onClose, suggestedUsers, onFollowSuggestion, onViewProfile }: any) => {
  if (!visible) return null;

  const formatCount = (count: number) => count > 100 ? '99+' : String(count);

  const renderUser = ({ item }: any) => (
    <TouchableOpacity
      style={styles.followingGridCell}
      onPress={() => onSelectUser(item)}
      activeOpacity={0.7}
    >
      <View style={styles.followingGridAvatarContainer}>
        <UserAvatar
          profilePicture={item.user_profile_picture}
          username={item.username}
          size={56}
          showLevelBadge={false}
          level={item.user_level}
          style={undefined}
        />
        <View style={styles.followingGridCountBadge}>
          <Text style={styles.followingGridCountText}>{formatCount(item.postCount)}</Text>
        </View>
      </View>
      <Text style={styles.followingGridUsername} numberOfLines={1}>
        {item.username}
      </Text>
    </TouchableOpacity>
  );

  const renderSuggestion = ({ item }: any) => (
    <View style={styles.followingGridCell}>
      <TouchableOpacity onPress={() => onViewProfile(item)} activeOpacity={0.7}>
        <View style={styles.followingGridAvatarContainer}>
          <UserAvatar
            profilePicture={item.user_profile_picture}
            username={item.username}
            size={56}
            showLevelBadge={false}
            level={item.user_level}
            style={undefined}
          />
        </View>
        <Text style={styles.followingGridUsername} numberOfLines={1}>
          {item.username}
        </Text>
      </TouchableOpacity>
      {!item.is_following ? (
        <TouchableOpacity
          style={styles.suggestionFollowButton}
          onPress={() => onFollowSuggestion(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.suggestionFollowButtonText}>Follow</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.suggestionFollowingBadge}>
          <Ionicons name="checkmark" size={12} color="#4ECDC4" />
          <Text style={styles.suggestionFollowingText}>Following</Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.followingGridOverlay}>
        <View style={styles.followingGridContainer}>
          <View style={styles.followingGridHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.followingGridTitle}>Following</Text>
              <Text style={styles.followingGridSubtitle}>
                {users.length > 0
                  ? `${users.length} ${users.length === 1 ? 'person' : 'people'} with posts — select to view on map`
                  : 'Suggested people to follow'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {users.length === 0 ? (
            suggestedUsers && suggestedUsers.length > 0 ? (
              <FlatList
                data={suggestedUsers}
                keyExtractor={(item: any) => item.user_id}
                numColumns={GRID_COLUMNS}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16 }}
                columnWrapperStyle={{ gap: 8 }}
                renderItem={renderSuggestion}
              />
            ) : (
              <View style={styles.followingGridEmptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.followingGridEmptyText}>Follow users to see their food posts here!</Text>
              </View>
            )
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item: any) => item.user_id}
              numColumns={GRID_COLUMNS}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16 }}
              columnWrapperStyle={{ gap: 8 }}
              renderItem={renderUser}
            />
          )}
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
// MAIN EXPLORE SCREEN
// ======================================================

export default function ExploreScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const auth = useAuth() as { user: any; token: string | null; accountType: string | null };
  const { user, token, accountType } = auth;
  const { register: registerExploreRefresh } = useExploreRefresh();

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<typeof MapView>(null);
  const videoPositions = useRef<Map<string, { top: number; height: number }>>(new Map());
  const cachedMapPosts = useRef<any[]>([]);
  const cachedMapRestaurants = useRef<any[]>([]);
  const cachedFollowersPosts = useRef<any[]>([]);
  const cachedUserLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const feedPostsLoadedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'map' | 'users' | 'topPosts' | 'popular'>(Platform.OS === 'android' ? 'users' : 'map');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const loadingRef = useRef(true);
  const pageRef = useRef(1);
  const feedSeedRef = useRef(Date.now().toString());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Trending banner state
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [showTrendingBanner, setShowTrendingBanner] = useState(false);
  const [trendingSlide, setTrendingSlide] = useState(0);
  const [trendingCountdown, setTrendingCountdown] = useState(10);
  const trendingBannerY = useRef(new Animated.Value(-400)).current;
  const trendingScale = useRef(new Animated.Value(0.8)).current;
  const trendingOpacity = useRef(new Animated.Value(0)).current;
  const trendingSlideAnim = useRef(new Animated.Value(0)).current;
  const trendingBannerShown = useRef(false);
  const [trendingTrigger, setTrendingTrigger] = useState(0);
  const trendingTimerRotation = useRef(new Animated.Value(0)).current;

  // Slide animated placeholder
  const PLACEHOLDER_PHRASES = [
    'Best Shawarma in JP Nagar',
    'Top Rated Biryani',
    'Most Liked Desserts',
    'Famous Pizza near Koramangala',
    'Trending Momos in Indiranagar',
    'Best Biryani Near Me',
  ];
  const [currentPhrase, setCurrentPhrase] = useState(PLACEHOLDER_PHRASES[0]);
  const phraseIndexRef = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (searchQuery || searchFocused) {
      return;
    }

    const cycle = () => {
      // Slide up + fade out
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -14, duration: 300, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        // Switch phrase
        phraseIndexRef.current = (phraseIndexRef.current + 1) % PLACEHOLDER_PHRASES.length;
        setCurrentPhrase(PLACEHOLDER_PHRASES[phraseIndexRef.current]);
        // Position below
        slideAnim.setValue(14);
        // Slide up into place + fade in
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      });
    };

    const id = setInterval(cycle, 2500);
    return () => clearInterval(id);
  }, [searchQuery, searchFocused]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTopPostsModal, setShowTopPostsModal] = useState(false);
  const [showTopPostsInfo, setShowTopPostsInfo] = useState(false);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [topPostsLoading, setTopPostsLoading] = useState(false);
  const [showFollowingUsersModal, setShowFollowingUsersModal] = useState(false);
  const [followingUsersModalData, setFollowingUsersModalData] = useState<any>(null);

  // Hero card border glow animation
  const heroBorderAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(heroBorderAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);
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
  const [mapFilterType, setMapFilterType] = useState<'posts' | 'restaurants' | 'following'>('posts');
  const [selectedFollowingUser, setSelectedFollowingUser] = useState<any>(null);
  const [showFollowingGrid, setShowFollowingGrid] = useState(false);

  // Derive followed users with post counts for the Following grid
  const followingUsersForGrid = React.useMemo(() => {
    if (mapFilterType !== 'following') return [];
    const userMap = new Map<string, any>();
    const source = cachedFollowersPosts.current;
    source.forEach((post: any) => {
      const uid = post.user_id || 'unknown';
      if (userMap.has(uid)) {
        userMap.get(uid)!.postCount += 1;
      } else {
        userMap.set(uid, {
          user_id: uid,
          username: post.username || 'Unknown',
          user_profile_picture: post.user_profile_picture || null,
          user_level: post.user_level || 1,
          postCount: 1,
        });
      }
    });
    return Array.from(userMap.values()).sort((a: any, b: any) => b.postCount - a.postCount);
  }, [mapFilterType, mapPosts]);

  const POSTS_PER_PAGE = 20;
  const CATEGORIES = [
  { id: 'all', name: 'All', emoji: '🍽️' },
  { id: 'vegetarian-vegan', name: 'Vegetarian/Vegan', emoji: '__veg__' },
  { id: 'non-vegetarian', name: 'Non vegetarian', emoji: '__nonveg__' },
  { id: 'biryani', name: 'Biryani', emoji: '🍛' },
  { id: 'cafe', name: 'Cafe', emoji: '🧁' },
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
];

// Static food images per category (fallback when no posts exist)
const CATEGORY_IMAGES: { [id: string]: any } = {
  'vegetarian-vegan': require('../../assets/categories/vegetarian-vegan.png'),
  'non-vegetarian': require('../../assets/categories/non-vegetarian.png'),
  'biryani': require('../../assets/categories/biryani.png'),
  'italian': require('../../assets/categories/italian.png'),
  'desserts': require('../../assets/categories/desserts.png'),
  'arabic': require('../../assets/categories/arabic.png'),
  'karnataka-style': require('../../assets/categories/karnataka-style.png'),
  'north-indian-style': require('../../assets/categories/north-indian-style.png'),
  'south-indian-style': require('../../assets/categories/south-indian-style.png'),
  'hyderabadi-style': require('../../assets/categories/hyderabadi-style.png'),
  'kerala-style': require('../../assets/categories/kerala-style.png'),
  'andhra-style': require('../../assets/categories/andhra-style.png'),
  'punjabi-style': require('../../assets/categories/punjabi-style.png'),
  'tea-coffee': require('../../assets/categories/tea-coffee.png'),
  'bengali-style': require('../../assets/categories/bengali-style.png'),
  'odia-style': require('../../assets/categories/odia-style.png'),
  'gujarati-style': require('../../assets/categories/gujarati-style.png'),
  'maharashtrian-style': require('../../assets/categories/maharashtrian-style.png'),
  'rajasthani-style': require('../../assets/categories/rajasthani-style.png'),
  'mangaluru-style': require('../../assets/categories/mangaluru-style.png'),
  'asian': require('../../assets/categories/asian.png'),
  'dosa': require('../../assets/categories/dosa.png'),
  'kashmiri': require('../../assets/categories/kashmiri-style.png'),
};

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

// Compute category previews (latest image + count) from cached map posts
const categoryPreviews = React.useMemo(() => {
  const cache = mapFilterType === 'following'
    ? (selectedFollowingUser
        ? cachedFollowersPosts.current.filter((p: any) => p.user_id === selectedFollowingUser.user_id)
        : cachedFollowersPosts.current)
    : cachedMapPosts.current;

  const previews: { [id: string]: { count: number; imageUrl: string | null } } = {};
  QUICK_CATEGORIES.forEach(cat => {
    const catPosts = cache.filter((post: any) => {
      const postCategory = post.category?.toLowerCase().trim();
      return postCategory === cat.name.toLowerCase().trim();
    });
    // Sort by newest first
    catPosts.sort((a: any, b: any) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    previews[cat.id] = {
      count: catPosts.length,
      imageUrl: catPosts[0]?.full_thumbnail_url || catPosts[0]?.full_image_url || null,
    };
  });
  return previews;
}, [mapPosts, mapFilterType, selectedFollowingUser]);

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
      url = `${API_URL}/map/search?q=${encodeURIComponent(searchTerm)}&lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=50`;
    } else {
      url = `${API_URL}/map/pins?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=50`;
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
      cachedMapRestaurants.current = restaurants;
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

const handleQuickCategoryPress = (category: any) => {
  if (selectedQuickCategory === category.id) {
    // Deselect - show all cached posts (NO API CALL)
    setSelectedQuickCategory(null);
    if (activeTab === 'map') {
      // Use appropriate cache based on filter type, filtered to selected user if applicable
      const cacheToUse = mapFilterType === 'following'
        ? (selectedFollowingUser
            ? cachedFollowersPosts.current.filter((p: any) => p.user_id === selectedFollowingUser.user_id)
            : cachedFollowersPosts.current)
        : cachedMapPosts.current;
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
      // Filter from appropriate cache based on filter type, filtered to selected user if applicable
      const cacheToUse = mapFilterType === 'following'
        ? (selectedFollowingUser
            ? cachedFollowersPosts.current.filter((p: any) => p.user_id === selectedFollowingUser.user_id)
            : cachedFollowersPosts.current)
        : cachedMapPosts.current;
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
  const handleMapFilterChange = async (newFilterType: 'posts' | 'restaurants' | 'following') => {
    setMapFilterType(newFilterType);

    // Clear quick category selection when changing filter type
    setSelectedQuickCategory(null);

    // Reset following-specific state when switching away
    if (newFilterType !== 'following') {
      setSelectedFollowingUser(null);
      setShowFollowingGrid(false);
    }

    if (newFilterType === 'following') {
      // Fetch followers posts (will use cache if available)
      await fetchFollowersPosts();
      // Show user grid overlay after data is loaded
      setShowFollowingGrid(true);
      setSelectedFollowingUser(null);
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
      // Restore cached restaurants (may have been cleared by Following tab)
      if (mapRestaurants.length === 0 && cachedMapRestaurants.current.length > 0) {
        setMapRestaurants(cachedMapRestaurants.current);
      }
    }
  };

  const handleRestaurantPress = (restaurant: any) => {
    setSelectedRestaurant(restaurant);
    setShowRestaurantModal(true);
  };

  const handlePostPress = async (post: any) => {
    setSelectedPost(post);
    setShowPostModal(true);

    // Track click (same logic as grid tiles)
    if (post && !post.is_clicked) {
      const updateClick = (p: any) =>
        p.id === post.id ? { ...p, clicks_count: (p.clicks_count || 0) + 1, is_clicked: true } : p;

      // Update displayed posts
      setMapPosts((prev) => prev.map(updateClick));

      // Also update caches so count persists on back navigation
      if (mapFilterType === 'following') {
        cachedFollowersPosts.current = cachedFollowersPosts.current.map(updateClick);
      } else {
        cachedMapPosts.current = cachedMapPosts.current.map(updateClick);
      }

      try {
        const tkn = await AsyncStorage.getItem('token');
        axios.post(`${API_URL}/posts/${post.id}/click`, {}, {
          headers: { Authorization: `Bearer ${tkn}` }
        }).catch(() => {});
      } catch {}
    }
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

  // Following mode: handle marker press
  const handleFollowingLocationPress = (location: any) => {
    const { users, locationName } = location;
    if (users.length === 1) {
      // Single user → go directly to location-details
      router.push({
        pathname: "/location-details",
        params: { locationName: encodeURIComponent(locationName) },
      });
    } else {
      // Multiple users → show intermediate modal
      setFollowingUsersModalData({ locationName, users });
      setShowFollowingUsersModal(true);
    }
  };

  // Following mode: handle user selection from modal
  const handleFollowingUserSelect = (user: any, locationName: string) => {
    setShowFollowingUsersModal(false);
    setFollowingUsersModalData(null);
    router.push({
      pathname: "/location-details",
      params: { locationName: encodeURIComponent(locationName) },
    });
  };

  // Following grid: user tapped from grid → show their posts on map
  const handleFollowingGridUserSelect = (user: any) => {
    setSelectedFollowingUser(user);
    setShowFollowingGrid(false);

    // Filter mapPosts to only this user's posts
    const userPosts = cachedFollowersPosts.current.filter(
      (post: any) => post.user_id === user.user_id
    );
    setMapPosts(userPosts);

    // Zoom map to fit user's posts
    if (userPosts.length > 0 && mapRef.current) {
      const coords = userPosts
        .filter((p: any) => p.latitude && p.longitude)
        .map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }));
      if (coords.length > 0) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  };

  // Following grid: back button → return to grid
  const handleBackToFollowingGrid = () => {
    setSelectedFollowingUser(null);
    setShowFollowingGrid(true);
    setMapPosts(cachedFollowersPosts.current);
  };

  // Following grid: close/dismiss grid overlay
  const handleFollowingGridClose = () => {
    setShowFollowingGrid(false);
    // If no following users, switch back to posts so user isn't stuck on empty map
    if (followingUsersForGrid.length === 0) {
      setMapFilterType('posts');
      if (cachedMapPosts.current.length > 0) {
        setMapPosts(cachedMapPosts.current);
      }
    }
  };

  // Derive top 8 unique user suggestions from topPosts for empty Following state
  const suggestedUsersForGrid = React.useMemo(() => {
    if (followingUsersForGrid.length > 0) return [];
    const seen = new Set<string>();
    const suggestions: any[] = [];
    for (const post of topPosts) {
      if (!post.user_id || post.user_id === user?.id || seen.has(post.user_id)) continue;
      seen.add(post.user_id);
      suggestions.push({
        user_id: post.user_id,
        username: post.username || 'Unknown',
        user_profile_picture: post.user_profile_picture || null,
        user_level: post.user_level || 1,
        account_type: post.account_type,
        is_following: post.is_following || false,
      });
      if (suggestions.length >= 8) break;
    }
    return suggestions;
  }, [topPosts, followingUsersForGrid, user?.id]);

  // Fetch top posts when Following tab opens with empty state (for suggestions)
  useEffect(() => {
    if (showFollowingGrid && followingUsersForGrid.length === 0 && topPosts.length === 0) {
      fetchTopPosts();
    }
  }, [showFollowingGrid, followingUsersForGrid.length]);

  // Handle follow from suggestion in Following grid
  const handleFollowSuggestion = async (suggestedUser: any) => {
    if (!suggestedUser.user_id) return;
    try {
      await followUser(suggestedUser.user_id, suggestedUser.account_type);
      // Update the suggestion's is_following state via topPosts
      setTopPosts((prev: any[]) => prev.map((p: any) =>
        p.user_id === suggestedUser.user_id ? { ...p, is_following: true } : p
      ));
    } catch {
      Alert.alert("Error", "Failed to follow user. Please try again.");
    }
  };

  // Handle view profile from suggestion in Following grid
  const handleViewSuggestedProfile = (suggestedUser: any) => {
    setShowFollowingGrid(false);
    setMapFilterType('posts');
    if (cachedMapPosts.current.length > 0) {
      setMapPosts(cachedMapPosts.current);
    }
    router.push(`/profile?userId=${suggestedUser.user_id}`);
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
      // Determine which cache to use based on filter type, filtered to selected user if applicable
      const cacheToUse = mapFilterType === 'following'
        ? (selectedFollowingUser
            ? cachedFollowersPosts.current.filter((p: any) => p.user_id === selectedFollowingUser.user_id)
            : cachedFollowersPosts.current)
        : cachedMapPosts.current;

      if (cacheToUse.length > 0) {
        // Always re-apply correct posts on focus (handles returning from navigation)
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
        if (mapFilterType === 'following') {
          fetchFollowersPosts(true);
        } else {
          fetchMapPins(undefined, true);
        }
      }
    }

    // Users tab logic - use ref to avoid stale closure triggering unnecessary refetches
    if (user && token && activeTab === 'users' && !feedPostsLoadedRef.current) {
      fetchPosts(true);
    }

    return () => {
      setPlayingVideos([]);
      // Clear image memory cache on Android when leaving screen to prevent OOM
      if (Platform.OS === 'android') {
        Image.clearMemoryCache();
      }
    };
  }, [activeTab, userLocation, selectedQuickCategory, selectedFollowingUser, user, token])
);

  // ======================================================
  // TRENDING BANNER - fetch and auto-slide
  // ======================================================
  // Also trigger banner on screen focus (single tab click)
  useFocusEffect(
    useCallback(() => {
      if (token && !trendingBannerShown.current && !showTrendingBanner) {
        setTrendingTrigger(t => t + 1);
      }
    }, [token, showTrendingBanner])
  );

  useEffect(() => {
    if (!token || trendingBannerShown.current) return;
    const buildTrending = (posts: any[]) => {
      const mapped = posts.map((p: any) => ({
        ...p,
        full_image_url: fixUrl(p.media_url || p.image_url),
        full_thumbnail_url: fixUrl(p.thumbnail_url),
      }));
      mapped.sort((a: any, b: any) => ((b.likes_count || 0) + (b.clicks_count || 0)) - ((a.likes_count || 0) + (a.clicks_count || 0)));
      // Balanced mix: 3 regular + up to 2 restaurant (or fill with whatever is available)
      const regular = mapped.filter((p: any) => p.account_type !== 'restaurant');
      const restaurant = mapped.filter((p: any) => p.account_type === 'restaurant');
      const trending: any[] = [];
      // Take top 3 regular
      trending.push(...regular.slice(0, 3));
      // Insert up to 2 restaurant posts at positions 2 and 4
      if (restaurant.length > 0) trending.splice(2, 0, restaurant[0]);
      if (restaurant.length > 1) trending.splice(4, 0, restaurant[1]);
      // If not enough regular posts, fill remaining slots from restaurant
      if (trending.length < 5) trending.push(...restaurant.slice(trending.length - regular.length > 0 ? trending.length - regular.length : 0).filter((p: any) => !trending.includes(p)));
      // If not enough restaurant posts, fill from remaining regular
      if (trending.length < 5) trending.push(...regular.slice(3, 3 + (5 - trending.length)));
      return trending.slice(0, 5);
    };

    const animateBannerIn = () => {
      trendingBannerY.setValue(-400);
      trendingScale.setValue(0.8);
      trendingOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(trendingBannerY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
        Animated.spring(trendingScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
        Animated.timing(trendingOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    };

    const fetchTrending = async () => {
      const headers = { Authorization: `Bearer ${token}` };
      const allPosts: any[] = [];
      const seenIds = new Set();
      let bannerShown = false;

      const addPosts = (posts: any[]) => {
        posts.forEach((p: any) => {
          const pid = p.id || p._id;
          if (!seenIds.has(pid)) {
            seenIds.add(pid);
            allPosts.push(p);
          }
        });
      };

      const tryShowBanner = () => {
        if (!mountedRef.current) return;
        const trending = buildTrending(allPosts);
        if (trending.length === 0) return;
        setTrendingPosts(trending);
        if (!trendingBannerShown.current) {
          trendingBannerShown.current = true;
          setShowTrendingBanner(true);
          animateBannerIn();
          bannerShown = true;
        }
      };

      // Fast small request for instant banner + full request for complete data
      const promises = [
        axios.get(`${API_URL}/feed?skip=0&limit=15&sort=engagement`, { headers }).then(res => {
          addPosts(res.data || []);
          tryShowBanner();
        }).catch(() => {}),
        axios.get(`${API_URL}/feed?skip=0&limit=50&sort=engagement`, { headers }).then(res => {
          addPosts(res.data || []);
          tryShowBanner();
        }).catch(() => {}),
      ];

      await Promise.allSettled(promises);

      if (!mountedRef.current) return;
      const trending = buildTrending(allPosts);
      if (trending.length > 0) {
        setTrendingPosts(trending);
        if (!bannerShown && !trendingBannerShown.current) {
          trendingBannerShown.current = true;
          setShowTrendingBanner(true);
          animateBannerIn();
        }
      }
    };
    fetchTrending();
  }, [token, trendingTrigger]);

  // Keep a ref of trending posts length to avoid stale closures
  const trendingPostsLenRef = useRef(trendingPosts.length);
  trendingPostsLenRef.current = trendingPosts.length;

  // Reset slide to 0 when posts list grows (more data arrived)
  useEffect(() => {
    if (trendingPosts.length > 1) {
      setTrendingSlide(0);
    }
  }, [trendingPosts.length]);

  // Auto-slide trending posts — 2 seconds per post
  useEffect(() => {
    if (!showTrendingBanner || trendingPosts.length <= 1) return;

    const slideInterval = setInterval(() => {
      setTrendingSlide(prev => {
        const next = prev + 1;
        if (next >= trendingPostsLenRef.current) {
          return prev; // stay on last
        }
        trendingSlideAnim.setValue(1);
        Animated.timing(trendingSlideAnim, { toValue: 0, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
        return next;
      });
    }, 2000);

    return () => clearInterval(slideInterval);
  }, [showTrendingBanner, trendingPosts.length]);

  // Countdown timer for trending banner with rotation animation
  useEffect(() => {
    if (!showTrendingBanner) return;
    trendingTimerRotation.setValue(0);
    // Animate full rotation over 10 seconds (anti-clockwise)
    Animated.timing(trendingTimerRotation, {
      toValue: 1,
      duration: 10000,
      useNativeDriver: true,
      easing: Easing.linear,
    }).start();
    const countdownInterval = setInterval(() => {
      setTrendingCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          closeTrendingBanner();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownInterval);
  }, [showTrendingBanner]);

  const closeTrendingBanner = useCallback(() => {
    Animated.parallel([
      Animated.timing(trendingBannerY, { toValue: -500, duration: 400, useNativeDriver: true, easing: Easing.in(Easing.back(1.5)) }),
      Animated.timing(trendingScale, { toValue: 0.5, duration: 400, useNativeDriver: true }),
      Animated.timing(trendingOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => {
      setShowTrendingBanner(false);
      setTrendingCountdown(10);
      setTrendingSlide(0);
    });
  }, []);

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

  const fetchPostsRef = useRef<any>(null);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    scrollYRef.current = contentOffset.y;
    calculateVisibleVideos(contentOffset.y);
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - SCREEN_HEIGHT * 3) {
      if (hasMoreRef.current && !loadingMoreRef.current && !loadingRef.current) fetchPostsRef.current(false);
    }
  }, [calculateVisibleVideos]);

  useEffect(() => {
    if (posts.length > 0) {
      const timer = setTimeout(() => calculateVisibleVideos(scrollYRef.current), 500);
      return () => clearTimeout(timer);
    }
  }, [posts.length]);

  const mapPostData = (post: any) => {
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
  };

  const fetchPosts = async (refresh = false, categories?: string[], tab?: 'map' | 'users') => {
    try {
      if (refresh) {
        setLoading(true); loadingRef.current = true;
        setPage(1); pageRef.current = 1;
        setHasMore(true); hasMoreRef.current = true;
        feedSeedRef.current = Date.now().toString();
        videoPositions.current.clear();
      } else {
        if (!hasMoreRef.current || loadingMoreRef.current) return;
        setLoadingMore(true); loadingMoreRef.current = true;
      }
      const categoriesToUse = categories ?? appliedCategories;
      const currentTab = tab ?? activeTab;
      const skip = refresh ? 0 : (pageRef.current - 1) * POSTS_PER_PAGE;

      const categoryParam = categoriesToUse.length > 0
        ? `&categories=${encodeURIComponent(categoriesToUse.join(","))}`
        : '';
      const sortParam = '&sort=mixed';
      const seedParam = `&seed=${feedSeedRef.current}`;

      // Progressive loading: on refresh, fetch first 6 posts fast, then load the rest
      if (refresh) {
        const INITIAL_BATCH = 6;
        const firstUrl = `${API_URL}/feed?skip=0&limit=${INITIAL_BATCH}${categoryParam}${sortParam}${seedParam}`;
        const firstRes = await axios.get(firstUrl, { headers: { Authorization: `Bearer ${token || ""}` } });
        if (!mountedRef.current) return;

        if (firstRes.data.length === 0) {
          setHasMore(false);
          setPosts([]);
          feedPostsLoadedRef.current = true;
          return;
        }

        const firstPosts = firstRes.data.map(mapPostData);
        setPosts(firstPosts);
        feedPostsLoadedRef.current = true;
        setLoading(false); loadingRef.current = false; // Show first cards immediately

        // Pre-fetch thumbnails after UI settles (non-blocking)
        InteractionManager.runAfterInteractions(() => {
          firstPosts.forEach((post: any) => {
            const urlToPreFetch = post.full_thumbnail_url || post.full_image_url;
            if (urlToPreFetch && !post._isVideo) {
              Image.prefetch(urlToPreFetch);
            }
          });
        });

        if (firstRes.data.length < INITIAL_BATCH) {
          setHasMore(false); hasMoreRef.current = false;
          setPage(2); pageRef.current = 2;
          return;
        }

        // Load remaining posts in background
        const restUrl = `${API_URL}/feed?skip=${INITIAL_BATCH}&limit=${POSTS_PER_PAGE - INITIAL_BATCH}${categoryParam}${sortParam}${seedParam}`;
        const restRes = await axios.get(restUrl, { headers: { Authorization: `Bearer ${token || ""}` } });
        if (!mountedRef.current) return;

        if (restRes.data.length > 0) {
          const restPosts = restRes.data.map(mapPostData);
          setPosts(prev => {
            const existingIds = new Set(prev.map((p) => p.id));
            return [...prev, ...restPosts.filter((np: any) => !existingIds.has(np.id))];
          });
        }

        const totalFetched = firstRes.data.length + (restRes.data?.length || 0);
        if (totalFetched < POSTS_PER_PAGE) { setHasMore(false); hasMoreRef.current = false; }
        setPage(2); pageRef.current = 2;
      } else {
        // Pagination: load next page normally
        let feedUrl = `${API_URL}/feed?skip=${skip}&limit=${POSTS_PER_PAGE}${categoryParam}${sortParam}${seedParam}`;
        const res = await axios.get(feedUrl, { headers: { Authorization: `Bearer ${token || ""}` } });
        if (!mountedRef.current) return;

        if (res.data.length === 0) {
          setHasMore(false); hasMoreRef.current = false;
          return;
        }

        const newPosts = res.data.map(mapPostData);
        setPosts((p) => [...p, ...newPosts.filter((np: any) => !p.some((ep) => ep.id === np.id))]);
        setPage((prev) => { pageRef.current = prev + 1; return prev + 1; });

        if (newPosts.length < POSTS_PER_PAGE) { setHasMore(false); hasMoreRef.current = false; }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("Fetch error:", err);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false); loadingRef.current = false;
      setLoadingMore(false); loadingMoreRef.current = false;
      setRefreshing(false);
    }
  };

  fetchPostsRef.current = fetchPosts;

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
      // Only show images, not videos
      const imageOnly = (res.data || []).filter((p: any) => !isVideoFile(p.image_url || p.media_url || '', p.media_type));
      setTopPosts(imageOnly);
    } catch (err) {
      if (!mountedRef.current) return;
    } finally {
      if (mountedRef.current) setTopPostsLoading(false);
    }
  };

  // Deep link: switch to topPosts tab when navigated with ?tab=topPosts
  useEffect(() => {
    if (tab === 'topPosts' && activeTab !== 'topPosts') {
      setActiveTab('topPosts');
      setPlayingVideos([]);
      fetchTopPosts();
    }
  }, [tab]);

  const performSearch = () => { if (searchQuery.trim()) { Keyboard.dismiss(); const q = searchQuery.trim(); setSearchQuery(''); router.push({ pathname: "/search-results", params: { query: q } }); } };
  const toggleCategory = (itemName: string) => { 
  setSelectedCategories((prev) => 
    prev.includes(itemName) 
      ? prev.filter((c) => c !== itemName) 
      : [...prev, itemName]
  ); 
};
  const handleLike = async (id: string, liked: boolean) => { setPosts((prev) => prev.map((p) => p.id === id ? { ...p, is_liked: !liked, likes_count: p.likes_count + (liked ? -1 : 1) } : p)); try { liked ? await unlikePost(id) : await likePost(id); } catch {} };
  const [topPostFollowLoading, setTopPostFollowLoading] = useState<string | null>(null);
  const handleTopPostFollow = (postItem: any) => {
    if (!postItem.user_id || topPostFollowLoading) return;
    Alert.alert(
      "Follow User",
      `Do you want to follow ${postItem.username || "this user"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Follow",
          onPress: async () => {
            setTopPostFollowLoading(postItem.user_id);
            setTopPosts((prev: any[]) => prev.map((p: any) => p.user_id === postItem.user_id ? { ...p, is_following: true } : p));
            try {
              await followUser(postItem.user_id, postItem.account_type);
              Alert.alert("Success", `You are now following ${postItem.username || "this user"}`);
            } catch {
              setTopPosts((prev: any[]) => prev.map((p: any) => p.user_id === postItem.user_id ? { ...p, is_following: false } : p));
              Alert.alert("Error", "Failed to follow user. Please try again.");
            } finally {
              setTopPostFollowLoading(null);
            }
          },
        },
      ]
    );
  };
  const handleView = async (postId: string) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, views_count: (p.views_count || 0) + 1, is_viewed: true } : p));
    try {
      const tkn = await AsyncStorage.getItem('token');
      axios.post(`${API_URL}/posts/${postId}/view`, {}, {
        headers: { Authorization: `Bearer ${tkn}` }
      }).catch(() => {});
    } catch {}
  };
  const onRefresh = useCallback(() => { setRefreshing(true); setPlayingVideos([]); fetchPosts(true); }, [appliedCategories]);

  // Register explore tab tap to refresh + re-show trending banner
  // Don't call onRefresh() which shows loading spinner - refresh silently in background
  useEffect(() => {
    registerExploreRefresh(() => {
      // Show banner immediately
      trendingBannerShown.current = false;
      setShowTrendingBanner(false);
      setTrendingPosts([]);
      setTrendingSlide(0);
      setTrendingCountdown(10);
      setTrendingTrigger(t => t + 1);
      // Silent background refresh - no loading spinner
      setPlayingVideos([]);
      fetchPostsRef.current?.(true);
    });
  }, []);

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

  if (!user || !token) return <View style={styles.center}><ActivityIndicator size="large" color="#E94A37" /><Text>Authenticating…</Text></View>;

return (
  <View style={styles.container}>
    <View style={styles.headerContainer}>
      {/* GRADIENT HEADER REMOVED - START DIRECTLY WITH SEARCH */}

      {/* TOP POSTS | DASHBOARD/MAP | USERS TOGGLE */}
<View style={styles.toggleContainer}>
  <View style={styles.toggleBackground}>
    {accountType !== 'restaurant' && (
    <TouchableOpacity
      style={[styles.toggleTab, activeTab === 'topPosts' && styles.toggleTabActive]}
      onPress={() => {
        if (activeTab !== 'topPosts') {
          setActiveTab('topPosts');
          setPlayingVideos([]);
          fetchTopPosts();
        }
      }}
      activeOpacity={0.7}
    >
      {activeTab === 'topPosts' ? (
        <LinearGradient colors={["#FF2E2E", "#FF7A18"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.toggleTabGradient}>
          <Text style={{ fontSize: 13, marginRight: 4 }}>⭐</Text>
          <Text style={styles.toggleTabTextWhite}>Foodies</Text>
        </LinearGradient>
      ) : (
        <View style={styles.toggleTabInner}>
          <Text style={{ fontSize: 13, marginRight: 4 }}>⭐</Text>
          <Text style={styles.toggleTabText}>Foodies</Text>
        </View>
      )}
    </TouchableOpacity>
    )}

    <TouchableOpacity
      style={[styles.toggleTab, activeTab === 'map' && styles.toggleTabActive]}
      onPress={() => {
        if (activeTab !== 'map') {
          setActiveTab('map');
          setPlayingVideos([]);
        }
      }}
      activeOpacity={0.7}
    >
      {activeTab === 'map' ? (
        <LinearGradient colors={["#FF2E2E", "#FF7A18"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.toggleTabGradient}>
          <Ionicons name="location" size={14} color="#FFF" style={{ marginRight: 5 }} />
          <Text style={styles.toggleTabTextWhite}>Map</Text>
        </LinearGradient>
      ) : (
        <View style={styles.toggleTabInner}>
          <Ionicons name="location-outline" size={14} color="#888" style={{ marginRight: 5 }} />
          <Text style={styles.toggleTabText}>Map</Text>
        </View>
      )}
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
      activeOpacity={0.7}
    >
      {activeTab === 'users' ? (
        <LinearGradient colors={["#FF2E2E", "#FF7A18"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.toggleTabGradient}>
          <Text style={{ fontSize: 13, marginRight: 4 }}>{accountType === 'restaurant' ? '👥' : '😋'}</Text>
          <Text style={styles.toggleTabTextWhite}>{accountType === 'restaurant' ? 'Users' : 'Dishes'}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.toggleTabInner}>
          <Text style={{ fontSize: 13, marginRight: 4 }}>{accountType === 'restaurant' ? '👥' : '😋'}</Text>
          <Text style={styles.toggleTabText}>{accountType === 'restaurant' ? 'Users' : 'Dishes'}</Text>
        </View>
      )}
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.toggleTab, activeTab === 'popular' && styles.toggleTabActive]}
      onPress={() => {
        if (activeTab !== 'popular') {
          setActiveTab('popular');
          setPlayingVideos([]);
          if (accountType === 'restaurant' && posts.length === 0) {
            setLoading(true);
            fetchPosts(true, [], 'users');
          }
        }
      }}
      activeOpacity={0.7}
    >
      {activeTab === 'popular' ? (
        <LinearGradient colors={["#FF2E2E", "#FF7A18"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.toggleTabGradient}>
          {accountType === 'restaurant' ? (
            <Text style={{ fontSize: 13, marginRight: 4 }}>😋</Text>
          ) : (
            <Ionicons name="flame" size={14} color="#FFF" style={{ marginRight: 5 }} />
          )}
          <Text style={styles.toggleTabTextWhite}>{accountType === 'restaurant' ? 'Dishes' : 'Popular'}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.toggleTabInner}>
          {accountType === 'restaurant' ? (
            <Text style={{ fontSize: 13, marginRight: 4 }}>😋</Text>
          ) : (
            <Ionicons name="flame-outline" size={14} color="#888" style={{ marginRight: 5 }} />
          )}
          <Text style={styles.toggleTabText}>{accountType === 'restaurant' ? 'Dishes' : 'Popular'}</Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
</View>

      {/* Search Box and Categories - Shown for MAP and USERS/DISHES tabs, hidden for TOP POSTS and restaurant Users tab */}
      {activeTab !== 'topPosts' && !(accountType === 'restaurant' && activeTab === 'users') && !(accountType !== 'restaurant' && activeTab === 'popular') && (
        <>
          {/* Search Box */}
          <View style={styles.searchBoxWrapper}>
            <View style={styles.searchBox}>
              <TouchableOpacity onPress={performSearch} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ zIndex: 10 }}>
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
                    <View style={{ height: 18, overflow: 'hidden', justifyContent: 'center' }}>
                      <Animated.Text
                        style={[
                          styles.animatedPlaceholderTyping,
                          {
                            transform: [{ translateY: slideAnim }],
                            opacity: opacityAnim,
                          },
                        ]}
                      >
                        {currentPhrase}
                      </Animated.Text>
                    </View>
                  </View>
                )}
              </View>

              {/* COMPACT CATEGORY FILTER BUTTON */}
              <TouchableOpacity onPress={() => setShowCategoryModal(true)} activeOpacity={0.8}>
                <LinearGradient
                  colors={["#FF2E2E", "#FF7A18"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.categoryButtonGradient}
                >
                  <Ionicons name="grid-outline" size={16} color="#FFF" />
                  {appliedCategories.length > 0 && (
                    <Text style={styles.categoryButtonBadge}>{appliedCategories.length}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* CATEGORIES — photo carousel on both Dishes and Map (Map shows count badges) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryCarouselScroll}
            contentContainerStyle={styles.categoryCarouselContainer}
          >
            {QUICK_CATEGORIES.map((category) => {
              const isActive = selectedQuickCategory === category.id;
              const preview = activeTab === 'map' ? categoryPreviews[category.id] : null;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    isActive && styles.categoryCardActive,
                  ]}
                  onPress={() => handleQuickCategoryPress(category)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryCardImageInner, isActive && { transform: [{ scale: 1.08 }] }]}>
                    {isActive && <View style={styles.categoryCardNeonGlow} />}
                    <View style={styles.categoryCardImagePlain}>
                      {CATEGORY_IMAGES[category.id] ? (
                        <Image
                          source={CATEGORY_IMAGES[category.id]}
                          style={styles.categoryCardImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.categoryCardPlaceholder}>
                          {renderCategoryIcon(category.emoji, 20, 0)}
                        </View>
                      )}
                    </View>
                    {/* Count badge — only on Map tab when posts exist */}
                    {activeTab === 'map' && (preview?.count ?? 0) > 0 && (
                      <View style={styles.categoryCardCountBadge}>
                        <Text style={styles.categoryCardCountText}>{preview!.count > 99 ? '99+' : preview!.count}</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.categoryCardLabel,
                      isActive && styles.categoryCardLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}
</View>

      {/* Category Tags - shown when filters are applied on relevant tabs */}
      {((accountType !== 'restaurant' && activeTab === 'users') || (accountType === 'restaurant' && (activeTab === 'popular' || activeTab === 'map'))) && appliedCategories.length > 0 && (
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
    // Use appropriate cache based on filter type, filtered to selected user if applicable
    const cacheToUse = mapFilterType === 'following'
      ? (selectedFollowingUser
          ? cachedFollowersPosts.current.filter((p: any) => p.user_id === selectedFollowingUser.user_id)
          : cachedFollowersPosts.current)
      : cachedMapPosts.current;
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
                <TouchableOpacity onPress={() => setShowTopPostsInfo(true)} style={{ marginLeft: 6, opacity: 0.85 }}>
                  <Ionicons name="information-circle" size={20} color="#E94A37" />
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
              <View style={styles.heroCardBorder}>
                {/* Animated rotating gradient border */}
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    width: 600,
                    height: 600,
                    top: '50%',
                    left: '50%',
                    marginTop: -300,
                    marginLeft: -300,
                    transform: [{
                      rotate: heroBorderAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    }],
                  }}
                >
                  {/* Top half: bright red to gold */}
                  <LinearGradient
                    colors={['#FF0000', '#FF6600', '#FFD700']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: 600, height: 300 }}
                  />
                  {/* Bottom half: gold back to red (completing the circle) */}
                  <LinearGradient
                    colors={['#FFD700', '#FF6600', '#FF0000']}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 0 }}
                    style={{ width: 600, height: 300 }}
                  />
                </Animated.View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 40 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
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
                    {user?.id !== topPosts[0].user_id && !topPosts[0].is_following && (
                      <TouchableOpacity onPress={() => handleTopPostFollow(topPosts[0])} disabled={topPostFollowLoading === topPosts[0].user_id}>
                        <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topPostFollowButton}>
                          <Text style={styles.topPostFollowButtonText}>{topPostFollowLoading === topPosts[0].user_id ? '...' : 'Follow'}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>

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
                    {/* Gradient overlay for depth */}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.5)']}
                      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }}
                    />
                    {/* Dish name floating tag */}
                    {topPosts[0].dish_name && (
                      <View style={styles.heroImageDishTag}>
                        <Text style={styles.heroImageDishText} numberOfLines={1}>{topPosts[0].dish_name}</Text>
                      </View>
                    )}
                  </View>

                  {/* Review text snippet */}
                  {topPosts[0].review_text && (
                    <Text style={styles.heroReviewText} numberOfLines={2}>
                      "{topPosts[0].review_text}"
                    </Text>
                  )}

                  {/* Score Bar */}
                  <View style={styles.heroScoreRow}>
                    <View style={styles.heroScoreItem}>
                      <View style={styles.heroScoreIconCircle}>
                        <Ionicons name="star" size={16} color="#F2CF68" />
                      </View>
                      <Text style={styles.heroScoreValue}>{Math.round(topPosts[0].quality_score)}</Text>
                      <Text style={styles.heroScoreLabel}>Quality</Text>
                    </View>
                    <View style={styles.heroScoreDivider} />
                    <View style={styles.heroScoreItem}>
                      <View style={styles.heroScoreIconCircle}>
                        <MaskedView maskElement={<Ionicons name="heart" size={16} color="#000" />}>
                          <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 16, height: 16 }} />
                        </MaskedView>
                      </View>
                      <Text style={styles.heroScoreValue}>{topPosts[0].likes_count}</Text>
                      <Text style={styles.heroScoreLabel}>Likes</Text>
                    </View>
                    <View style={styles.heroScoreDivider} />
                    <View style={styles.heroScoreItem}>
                      <View style={[styles.heroScoreIconCircle, { backgroundColor: 'rgba(242, 207, 104, 0.15)' }]}>
                        <Ionicons name="trophy" size={16} color="#F2CF68" />
                      </View>
                      <Text style={[styles.heroScoreValue, { color: '#E94A37', fontSize: 22 }]}>{Math.round(topPosts[0].combined_score)}</Text>
                      <Text style={[styles.heroScoreLabel, { fontWeight: '700', color: '#E94A37' }]}>Score</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Regular Cards - Ranks 2-10 */}
            {topPosts.slice(1).map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(`/post-details/${item.id}`)}
                activeOpacity={0.9}
              >
                <View style={styles.regularCardBorder}>
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
                      {user?.id !== item.user_id && !item.is_following && (
                        <TouchableOpacity onPress={() => handleTopPostFollow(item)} disabled={topPostFollowLoading === item.user_id}>
                          <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.topPostFollowButton}>
                            <Text style={styles.topPostFollowButtonText}>{topPostFollowLoading === item.user_id ? '...' : 'Follow'}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Image Preview */}
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
                      {/* Gradient overlay */}
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.45)']}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }}
                      />
                      {/* Dish name overlay */}
                      {item.dish_name && (
                        <View style={styles.regularImageDishTag}>
                          <Text style={styles.regularImageDishText} numberOfLines={1}>{item.dish_name}</Text>
                        </View>
                      )}
                    </View>

                    {/* Review text snippet */}
                    {item.review_text && (
                      <Text style={styles.regularReviewText} numberOfLines={2}>
                        "{item.review_text}"
                      </Text>
                    )}

                    {/* Scores row */}
                    <View style={styles.regularScoresRow}>
                      <View style={styles.regularScoreItem}>
                        <Ionicons name="star" size={13} color="#F2CF68" />
                        <Text style={styles.regularScoreValue}>{Math.round(item.quality_score)}</Text>
                        <Text style={styles.regularScoreLabel}>Quality</Text>
                      </View>
                      <View style={styles.regularScoreDividerV} />
                      <View style={styles.regularScoreItem}>
                        <MaskedView maskElement={<Ionicons name="heart" size={13} color="#000" />}>
                          <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 13, height: 13 }} />
                        </MaskedView>
                        <Text style={styles.regularScoreValue}>{item.likes_count}</Text>
                        <Text style={styles.regularScoreLabel}>Likes</Text>
                      </View>
                      <View style={styles.regularScoreDividerV} />
                      <View style={styles.regularScoreItem}>
                        <Ionicons name="trophy" size={13} color="#F2CF68" />
                        <Text style={[styles.regularScoreValue, { fontWeight: '700', color: '#E94A37' }]}>{Math.round(item.combined_score)}</Text>
                        <Text style={[styles.regularScoreLabel, { fontWeight: '700', color: '#E94A37' }]}>Score</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : activeTab === 'map' ? (
  // MAP VIEW for all users
    <MapViewComponent
      userLocation={userLocation}
      restaurants={mapRestaurants}
      posts={mapPosts}
      onRestaurantPress={handleRestaurantPress}
      onPostPress={handlePostPress}
      onClusterPress={handleClusterPress}
      onFollowingLocationPress={handleFollowingLocationPress}
      isLoading={mapLoading}
      mapRef={mapRef}
      filterType={mapFilterType}
      onFilterChange={handleMapFilterChange}
      onCenterLocation={centerOnUserLocation}
      selectedCategory={selectedQuickCategory ? QUICK_CATEGORIES.find(c => c.id === selectedQuickCategory)?.name : null}
      selectedFollowingUser={selectedFollowingUser}
      onBackToFollowingGrid={handleBackToFollowingGrid}
    />
) : activeTab === 'popular' && accountType !== 'restaurant' ? (
        // POPULAR / HAPPENING PLACES VIEW (regular users only)
        <View style={{ flex: 1 }}>
          <HappeningPlaces embedded />
        </View>
) : accountType === 'restaurant' && activeTab === 'users' ? (
        // ACTIVE USERS LIST for restaurant users
        <ActiveUsersList token={token || ""} />
) : (
        // DISHES / POSTS GRID VIEW (regular users 'users' tab + restaurant users 'popular/Dishes' tab)
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
            <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={Platform.OS === 'android' ? 64 : 16} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E94A37" />}>
              <View style={styles.masonryContainer}>
                {columns.map((column, columnIndex) => (
                  <View key={columnIndex} style={styles.column}>
                    {column.map((item) => <GridTile key={item.id} item={item} onPress={handlePostPressGrid} onLike={handleLike} onVideoLayout={handleVideoLayout} playingVideos={playingVideos} onView={handleView} />)}
                  </View>
                ))}
              </View>
              {loadingMore && <View style={styles.loadingMore}><ActivityIndicator size="small" color="#E94A37" /></View>}
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
              // Use appropriate cache based on filter type, filtered to selected user if applicable
              const cacheToUse = mapFilterType === 'following'
                ? (selectedFollowingUser
                    ? cachedFollowersPosts.current.filter((p: any) => p.user_id === selectedFollowingUser.user_id)
                    : cachedFollowersPosts.current)
                : cachedMapPosts.current;
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
  // For map tab - filter from appropriate cache based on filter type, filtered to selected user if applicable
  const cacheToUse = mapFilterType === 'following'
    ? (selectedFollowingUser
        ? cachedFollowersPosts.current.filter((p: any) => p.user_id === selectedFollowingUser.user_id)
        : cachedFollowersPosts.current)
    : cachedMapPosts.current;
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
      <FollowingUsersModal
        visible={showFollowingUsersModal}
        data={followingUsersModalData}
        onClose={() => {
          setShowFollowingUsersModal(false);
          setFollowingUsersModalData(null);
        }}
        onSelectUser={handleFollowingUserSelect}
      />
      <FollowingUsersGrid
        visible={showFollowingGrid}
        users={followingUsersForGrid}
        onSelectUser={handleFollowingGridUserSelect}
        onClose={handleFollowingGridClose}
        suggestedUsers={suggestedUsersForGrid}
        onFollowSuggestion={handleFollowSuggestion}
        onViewProfile={handleViewSuggestedProfile}
      />

      {/* TRENDING BANNER OVERLAY */}
      {showTrendingBanner && trendingPosts.length > 0 && (
        <Animated.View style={[styles.trendingOverlay, { opacity: trendingOpacity }]}>
          <Animated.View style={[styles.trendingBanner, {
            transform: [
              { translateY: trendingBannerY },
              { scale: trendingScale },
              { perspective: 1000 },
              { rotateX: trendingBannerY.interpolate({ inputRange: [-400, 0], outputRange: ['15deg', '0deg'] }) },
            ],
          }]}>
            {/* Gradient Header */}
            <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.trendingHeaderGradient}>
              <View style={styles.trendingHeaderLeft}>
                <Text style={{ fontSize: 18 }}>🔥</Text>
                <View>
                  <Text style={styles.trendingTitle}>TRENDING DISH</Text>
                  <Text style={styles.trendingSubtitle}>in Cofau right now</Text>
                </View>
              </View>
              <View style={styles.trendingDots}>
                {trendingPosts.map((_: any, i: number) => (
                  i === trendingSlide ? (
                    <View key={i} style={[styles.trendingDot, styles.trendingDotActive]} />
                  ) : (
                    <View key={i} style={styles.trendingDot} />
                  )
                ))}
              </View>
            </LinearGradient>

            {/* Slide content - vertical layout */}
            <Animated.View style={[styles.trendingSlideContainer, {
              transform: [{ translateX: trendingSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) }],
              opacity: trendingSlideAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.3, 0] }),
            }]}>
              {trendingPosts[trendingSlide] && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => { closeTrendingBanner(); router.push(`/post-details/${trendingPosts[trendingSlide].id || trendingPosts[trendingSlide]._id}`); }}
                  style={styles.trendingCard}
                >
                  {/* Big food image */}
                  <View style={styles.trendingImageWrapper}>
                    <Image
                      source={{ uri: trendingPosts[trendingSlide].full_thumbnail_url || trendingPosts[trendingSlide].full_image_url }}
                      style={styles.trendingImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={150}
                    />
                    {/* Rank label - stretched to left edge */}
                    <LinearGradient colors={['#FFD700', '#FFA500']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.trendingRankBadge}>
                      <Text style={styles.trendingRankText}>#{trendingSlide + 1} Trending</Text>
                    </LinearGradient>
                  </View>
                  {/* Stats pills - sitting half on image, half on info */}
                  <View style={styles.trendingStatsRow}>
                    <LinearGradient colors={['#FFE8E8', '#FFF0F0']} style={styles.trendingStatPill}>
                      <Text style={{ fontSize: 12 }}>❤️</Text>
                      <Text style={styles.trendingStatTextLikes}>{(trendingPosts[trendingSlide].likes_count || 0) > 1000 ? `${((trendingPosts[trendingSlide].likes_count || 0) / 1000).toFixed(1)}K` : (trendingPosts[trendingSlide].likes_count || 0)}</Text>
                    </LinearGradient>
                    <LinearGradient colors={['#E8F4FF', '#F0F8FF']} style={styles.trendingStatPill}>
                      <Ionicons name="eye" size={13} color="#3B82F6" />
                      <Text style={styles.trendingStatTextViews}>{(trendingPosts[trendingSlide].clicks_count || 0) > 1000 ? `${((trendingPosts[trendingSlide].clicks_count || 0) / 1000).toFixed(1)}K` : (trendingPosts[trendingSlide].clicks_count || 0)}</Text>
                    </LinearGradient>
                  </View>
                  {/* Info below image */}
                  <View style={styles.trendingCardInfo}>
                    <View style={styles.trendingUserRow}>
                      <UserAvatar
                        profilePicture={trendingPosts[trendingSlide].user_profile_picture}
                        username={trendingPosts[trendingSlide].username}
                        size={36}
                        showLevelBadge={true}
                        level={trendingPosts[trendingSlide].user_level || 1}
                      />
                      <View style={styles.trendingUserInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.trendingUsername} numberOfLines={1}>{trendingPosts[trendingSlide].username}</Text>
                        </View>
                        {trendingPosts[trendingSlide].account_type === 'restaurant' ? (
                          <LinearGradient colors={['#FF2E2E', '#FF7A18']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.trendingRestaurantTag}>
                            <Ionicons name="storefront-outline" size={8} color="#fff" />
                            <Text style={styles.trendingRestaurantTagText}>Restaurant</Text>
                          </LinearGradient>
                        ) : trendingPosts[trendingSlide].location_name ? (
                          <View style={styles.trendingLocationTag}>
                            <Ionicons name="location-sharp" size={9} color="#E94A37" />
                            <Text style={styles.trendingLocationText} numberOfLines={1}>{trendingPosts[trendingSlide].location_name}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.trendingDishName} numberOfLines={1}>
                        {trendingPosts[trendingSlide].dish_name || trendingPosts[trendingSlide].review_text?.slice(0, 25) || 'Trending Dish'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Timer + close at bottom center */}
            <View style={styles.trendingFooter}>
              <TouchableOpacity onPress={closeTrendingBanner} activeOpacity={0.7} style={styles.trendingCloseBottom}>
                {/* Circular timer */}
                <View style={styles.trendingTimerOuter}>
                  <Animated.View style={[styles.trendingTimerRing, {
                    transform: [{ rotate: trendingTimerRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }) }],
                  }]}>
                    <View style={styles.trendingTimerArc} />
                  </Animated.View>
                  <View style={styles.trendingTimerInner}>
                    <Text style={styles.trendingCountdownText}>{trendingCountdown}</Text>
                  </View>
                </View>
                <View style={styles.trendingCloseLabels}>
                  <Text style={styles.trendingCloseBottomLabel}>Closes in {trendingCountdown}s</Text>
                  <Ionicons name="close-circle" size={16} color="#ccc" />
                </View>
              </TouchableOpacity>
              <Text style={styles.trendingDoubleTapHint}>Double Tap to see Trending</Text>
            </View>
          </Animated.View>
        </Animated.View>
      )}

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
    paddingTop: Platform.OS === 'ios' ? 62 : 40,  // Add safe area padding for Dynamic Island
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
    color: "#333",
    paddingVertical: Platform.OS === 'android' ? 4 : 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
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
    color: '#888',
    fontWeight: '500' as const,
  },
  animatedPlaceholderTyping: {
    fontSize: 14,
    color: '#E94A37',
    fontWeight: '600' as const,
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
  clicksBadge: { position: "absolute", top: 6, right: 6, flexDirection: "row", alignItems: "center", gap: 3 },
  clicksText: { color: "#fff", fontSize: 11, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
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
    padding: 3.5,
    marginBottom: 16,
    overflow: 'hidden' as const,
    shadowColor: '#FF2E2E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  heroCardInner: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    paddingBottom: 14,
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
    height: 320,
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
  heroImageDishTag: {
    position: 'absolute' as const,
    bottom: 12,
    left: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(233, 74, 55, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    maxWidth: '60%' as any,
  },
  heroImageDishText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  heroReviewText: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic' as const,
    lineHeight: 18,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  heroScoreRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: -4,
  },
  heroScoreItem: {
    alignItems: 'center' as const,
    gap: 4,
  },
  heroScoreIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 46, 46, 0.08)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  heroScoreLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500' as const,
  },
  heroScoreValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#333',
  },
  heroScoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E5E5',
  },
  regularCardBorder: {
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  regularCardInner: {
    backgroundColor: '#fff',
    borderRadius: 13,
    padding: 12,
  },
  regularCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
    marginLeft: 36,
  },
  topPostFollowButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  topPostFollowButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
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
    height: 220,
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
  regularImageDishTag: {
    position: 'absolute' as const,
    bottom: 10,
    left: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(233, 74, 55, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
    maxWidth: '55%' as any,
  },
  regularImageDishText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  regularReviewText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic' as const,
    lineHeight: 17,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  regularScoresRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: -2,
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
  dishNameTag: { position: "absolute", bottom: 4, left: 4, backgroundColor: "rgba(233, 74, 55, 0.85)", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, maxWidth: "65%", borderBottomWidth: 1.5, borderBottomColor: "rgba(180, 40, 30, 0.9)", borderRightWidth: 1, borderRightColor: "rgba(200, 50, 35, 0.6)", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2, flexDirection: "row" as const, alignItems: "center" as const, gap: 3, overflow: "hidden" as const },
  dishNameText: { color: "#fff", fontSize: 8, fontWeight: "600", flexShrink: 1 },
  dishNameArrow: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#FF2E2E", alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0 },
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
  justifyContent: 'center',
  borderRadius: 16,
  padding: 7,
  gap: 4,
},
categoryButtonBadge: {
  fontSize: 10,
  color: '#FFF',
  fontWeight: '700',
  backgroundColor: 'rgba(0,0,0,0.25)',
  borderRadius: 8,
  minWidth: 16,
  height: 16,
  textAlign: 'center',
  lineHeight: 16,
  overflow: 'hidden',
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
// ======================================================
// LOCATION MARKER STYLES (one marker per location)
// ======================================================
locationPostsBadge: {
  backgroundColor: '#E94A37',
  borderRadius: 10,
  paddingVertical: 2,
  paddingHorizontal: 8,
  marginBottom: 4,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.3,
  shadowRadius: 2,
  elevation: 6,
},
locationPostsBadgeText: {
  color: '#fff',
  fontSize: 10,
  fontWeight: 'bold',
},
locationMarkerBubble: {
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
locationMarkerImage: {
  width: 50,
  height: 50,
  borderRadius: 6,
},
locationMarkerPlaceholder: {
  width: 50,
  height: 50,
  borderRadius: 6,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#F2CF68',
},
// ======================================================
// ZOOM CLUSTER MARKER STYLES (merged locations when zoomed out)
// ======================================================
zoomClusterBubble: {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: '#E94A37',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 3,
  borderColor: '#fff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.4,
  shadowRadius: 5,
  elevation: 8,
  overflow: 'hidden',
},
zoomClusterImage: {
  width: 58,
  height: 58,
  borderRadius: 29,
  opacity: 0.4,
},
zoomClusterOverlay: {
  position: 'absolute',
  justifyContent: 'center',
  alignItems: 'center',
},
zoomClusterCount: {
  color: '#fff',
  fontSize: 18,
  fontWeight: 'bold',
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
},
zoomClusterLabel: {
  color: '#fff',
  fontSize: 9,
  fontWeight: '600',
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
},
zoomClusterArrow: {
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
markerViewsBadge: {
  position: 'absolute',
  top: 2,
  right: 2,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 1,
},
markerViewsText: {
  color: '#fff',
  fontSize: 7,
  fontWeight: '700',
  textShadowColor: 'rgba(0,0,0,0.8)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
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
// ======================================================
// CATEGORY CAROUSEL STYLES (photo preview cards)
// ======================================================
categoryCarouselScroll: {
  maxHeight: 90,
  marginBottom: 6,
  marginTop: 2,
},
categoryCarouselContainer: {
  paddingHorizontal: 12,
  gap: 8,
  flexDirection: 'row',
  alignItems: 'center',
},
categoryCard: {
  alignItems: 'center',
  width: 74,
},
categoryCardActive: {
},
categoryCardImageInner: {
  width: 54,
  height: 54,
  borderRadius: 27,
  overflow: 'visible',
},
categoryCardImagePlain: {
  width: 54,
  height: 54,
  borderRadius: 27,
  overflow: 'hidden',
},
categoryCardNeonGlow: {
  position: 'absolute',
  width: 54,
  height: 54,
  borderRadius: 27,
  backgroundColor: '#E94A37',
  shadowColor: '#E94A37',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 10,
  elevation: 10,
},
categoryCardImage: {
  width: 54,
  height: 54,
  borderRadius: 27,
},
categoryCardPlaceholder: {
  width: 54,
  height: 54,
  borderRadius: 27,
  backgroundColor: '#FFF8F0',
  justifyContent: 'center',
  alignItems: 'center',
},
categoryCardCountBadge: {
  position: 'absolute',
  top: 0,
  right: -2,
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
categoryCardCountText: {
  color: '#fff',
  fontSize: 8,
  fontWeight: 'bold',
},
categoryCardLabel: {
  fontSize: 10,
  fontWeight: '500',
  color: '#555',
  marginTop: 3,
  textAlign: 'center',
},
categoryCardLabelActive: {
  color: '#E94A37',
  fontWeight: '800',
  fontSize: 11,
},
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
  marginBottom: 6,
  paddingHorizontal: 12,
  paddingTop: 4,
},
toggleBackground: {
  flexDirection: 'row' as const,
  backgroundColor: '#F5F5F5',
  borderRadius: 28,
  padding: 3,
  width: '100%',
  gap: 3,
},
toggleTab: {
  flex: 1,
  borderRadius: 24,
  overflow: 'hidden' as const,
},
toggleTabActive: {},
toggleTabGradient: {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingVertical: 9,
  paddingHorizontal: 6,
  borderRadius: 24,
  shadowColor: '#FF2E2E',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 3,
},
toggleTabInner: {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  paddingVertical: 9,
  paddingHorizontal: 6,
},
toggleTabText: {
  fontSize: 12,
  fontWeight: '500' as const,
  color: '#888',
},
toggleTabTextWhite: {
  fontSize: 12,
  fontWeight: '700' as const,
  color: '#FFF',
},
toggleTabTextActive: {
  color: '#E94A37',
  fontWeight: '600' as const,
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

  postDetailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  saveActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  saveActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#888',
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
  // FOLLOWING MODE MARKER STYLES
  // ======================================================
  followingPostBubble: {
    backgroundColor: '#fff',
    padding: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  followingDPOverlay: {
    position: 'absolute' as const,
    top: -6,
    left: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden' as const,
    zIndex: 10,
    elevation: 10,
  },
  followingUserBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  followingCountBadge: {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    backgroundColor: '#E94A37',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 10,
    elevation: 8,
  },
  followingCountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold' as const,
  },
  followingMultiUserDP: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#fff',
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  followingSmallCountBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    backgroundColor: '#E94A37',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: '#fff',
    zIndex: 10,
    elevation: 8,
  },
  followingPlusNBadge: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 6,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
    elevation: 8,
  },
  followingPlusNText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold' as const,
  },
  followingMarkerArrow: {
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

  // ======================================================
  // FOLLOWING USERS MODAL STYLES
  // ======================================================
  followingUsersModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.6,
    minHeight: 200,
  },
  followingUsersModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  followingUsersModalTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#1a1a2e',
  },
  followingUsersModalLocation: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  followingUserRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  followingUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
  },
  followingUserAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E94A37',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  followingUserName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  followingUserPostCount: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },

  // ======================================================
  // FOLLOWING USERS GRID STYLES
  // ======================================================
  followingGridOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  followingGridContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.65,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  followingGridHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  followingGridTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#1a1a2e',
  },
  followingGridSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  followingGridCell: {
    alignItems: 'center' as const,
    paddingVertical: 12,
    width: (SCREEN_WIDTH - 40 - 24) / 4,
  },
  followingGridAvatarContainer: {
    position: 'relative' as const,
  },
  followingGridCountBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    backgroundColor: '#E94A37',
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  followingGridCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold' as const,
  },
  followingGridUsername: {
    fontSize: 11,
    color: '#333',
    marginTop: 6,
    textAlign: 'center' as const,
    maxWidth: 72,
  },
  followingGridEmptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 60,
  },
  followingGridEmptyText: {
    color: '#888',
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center' as const,
    paddingHorizontal: 20,
  },
  suggestionFollowButton: {
    backgroundColor: '#E94A37',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 6,
  },
  suggestionFollowButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold' as const,
  },
  suggestionFollowingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 6,
    gap: 2,
  },
  suggestionFollowingText: {
    color: '#4ECDC4',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  followingBackButton: {
    position: 'absolute' as const,
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  followingBackButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  // Trending banner styles
  trendingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  trendingBanner: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: SCREEN_WIDTH * 0.92,
    overflow: 'hidden',
    shadowColor: '#FF2E2E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 28,
  },
  trendingHeaderGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  trendingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendingTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1.5,
  },
  trendingSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  trendingClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingSlideContainer: {
    overflow: 'hidden',
  },
  trendingCard: {
    flexDirection: 'column',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  trendingImageWrapper: {
    position: 'relative',
    width: '100%',
  },
  trendingImage: {
    width: '100%',
    height: SCREEN_WIDTH * 0.75,
  },
  trendingRankBadge: {
    position: 'absolute',
    top: 12,
    left: 0,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  trendingRankText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  trendingStatsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: -18,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  trendingCardInfo: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  trendingUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendingAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  trendingAvatarPlaceholder: {
    backgroundColor: '#bbb',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderColor: '#fff',
  },
  trendingUserInfo: {
    gap: 3,
  },
  trendingUsername: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '700',
  },
  trendingDishName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    textAlign: 'right' as const,
  },
  trendingRestaurantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
  },
  trendingRestaurantTagText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  trendingLocationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start' as const,
  },
  trendingLocationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#777',
    maxWidth: 120,
  },
  trendingLevelBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FF7A18',
    backgroundColor: '#FFF5EB',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  trendingStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  trendingStatTextLikes: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E94A37',
  },
  trendingStatTextViews: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B82F6',
  },
  trendingFooter: {
    alignItems: 'center',
    paddingBottom: 14,
    paddingTop: 8,
    gap: 8,
  },
  trendingCloseBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendingTimerOuter: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingTimerRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#E8E8E8',
    borderTopColor: '#1a1a1a',
    borderRightColor: '#1a1a1a',
  },
  trendingTimerArc: {
    width: '100%',
    height: '100%',
  },
  trendingTimerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingCloseLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendingCloseBottomLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  trendingDoubleTapHint: {
    fontSize: 10,
    fontWeight: '500',
    color: '#bbb',
    letterSpacing: 0.3,
  },
  trendingDots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  trendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  trendingDotActive: {
    width: 18,
    backgroundColor: '#fff',
  },
  trendingCountdownText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
});