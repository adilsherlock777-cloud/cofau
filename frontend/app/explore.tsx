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
  Image as RNImage,
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
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Android - ULTRA LARGE (200x200) to prevent scaling down
  if (Platform.OS === 'android') {
    return (
      <Marker
        coordinate={{
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
        }}
        onPress={() => onPress(restaurant)}
        tracksViewChanges={false}
      >
        <View style={{
          width: 200,
          height: 200,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: '#E94A37',
            borderWidth: 6,
            borderColor: '#FFFFFF',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            elevation: 8,
          }}>
            {restaurant.profile_picture ? (
              <RNImage
                source={{ uri: fixUrl(restaurant.profile_picture) || '' }}
                style={{ width: 128, height: 128, borderRadius: 64 }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ width: 128, height: 128, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center', borderRadius: 64 }}>
                <Ionicons name="restaurant" size={52} color="#fff" />
              </View>
            )}
          </View>
          {/* Reviews badge */}
          <View style={{
            position: 'absolute',
            bottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#E94A37',
            borderRadius: 14,
            paddingVertical: 5,
            paddingHorizontal: 10,
            gap: 4,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            elevation: 4,
          }}>
            <Ionicons name="chatbubble" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
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
    console.log('❌ PostMarker: No coordinates for post', post.id);
    return null;
  }

  console.log('✅ Rendering PostMarker:', {
    id: post.id,
    lat: post.latitude,
    lng: post.longitude,
    platform: Platform.OS
  });

  // Stop tracking after 2 seconds regardless of image load
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Android - Colored pin with beautiful image callout
  if (Platform.OS === 'android') {
    console.log('📍 Creating marker with callout for Android post:', post.id);

    // Color-code by rating
    let pinColor = '#F2CF68'; // Default: Gold
    if (post.rating) {
      if (post.rating >= 8) pinColor = '#00C853'; // Green = Excellent
      else if (post.rating >= 6) pinColor = '#FF9800'; // Orange = Good
      else pinColor = '#FF2E2E'; // Red = Lower rated
    }

    const imageUrl = fixUrl(post.thumbnail_url || post.media_url);

    return (
      <Marker
        coordinate={{
          latitude: post.latitude,
          longitude: post.longitude,
        }}
        pinColor={pinColor}
        onCalloutPress={() => {
          console.log('🎯 Callout pressed, opening post:', post.id);
          onPress(post);
        }}
      >
        <Callout tooltip style={{ width: 220 }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 10,
            width: 220,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 8,
          }}>
            {imageUrl && (
              <RNImage
                source={{ uri: imageUrl }}
                style={{
                  width: 200,
                  height: 150,
                  borderRadius: 8,
                  marginBottom: 10,
                  backgroundColor: '#f0f0f0',
                }}
                resizeMode="cover"
              />
            )}
            <Text
              numberOfLines={2}
              style={{
                fontSize: 15,
                fontWeight: 'bold',
                color: '#000',
                marginBottom: 6,
              }}
            >
              {post.location_name || "Food Post"}
            </Text>
            {post.rating && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 6,
                backgroundColor: '#FFF8E1',
                padding: 6,
                borderRadius: 6,
              }}>
                <Text style={{ fontSize: 18, marginRight: 6 }}>⭐</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FF9800' }}>
                  {post.rating}/10
                </Text>
              </View>
            )}
            <Text style={{
              fontSize: 13,
              color: '#1E88E5',
              fontWeight: '600',
              marginTop: 4,
            }}>
              Tap to view full post →
            </Text>
          </View>
        </Callout>
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
      onPress={() => onPress(post)}
      tracksViewChanges={tracksChanges && !imageLoaded}
    >
      <View style={styles.postMarkerContainer}>
        <View style={styles.postMarkerBubble}>
          {post.thumbnail_url || post.media_url ? (
            <Image
              source={{ uri: fixUrl(post.thumbnail_url || post.media_url) || '' }}
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
        {post.rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.ratingBadgeText}>{post.rating}</Text>
          </View>
        )}
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

  // Get latest 3 posts
  const latestPosts = posts
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  // Stop tracking after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  console.log('✅ Rendering ClusterMarker:', {
    count,
    lat: latitude,
    lng: longitude,
    platform: Platform.OS
  });

  // Android - Use NATIVE pin with distinct color for clusters
  if (Platform.OS === 'android') {
    console.log('📍 Creating cluster marker for Android, count:', count);

    // Purple/violet for clusters to stand out from single posts
    const clusterColor = '#9C27B0'; // Purple for clusters

    return (
      <Marker
        coordinate={{ latitude, longitude }}
        onPress={() => {
          console.log('🎯 Cluster tapped! Count:', count);
          onPress(cluster);
        }}
        pinColor={clusterColor}
        title={`📍 ${count} posts here`}
        description={`Tap to see all ${count} posts at ${cluster.locationName || 'this location'}`}
      />
    );
  }

  // iOS layout with overlapping images
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={() => onPress(cluster)}
      tracksViewChanges={tracksChanges}
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
              {post.thumbnail_url || post.media_url ? (
                <Image
                  source={{ uri: fixUrl(post.thumbnail_url || post.media_url) }}
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
              {/* Rating badge on each preview */}
              {post.rating && (
                <View style={styles.clusterRatingBadge}>
                  <Ionicons name="star" size={8} color="#FFD700" />
                  <Text style={styles.clusterRatingText}>{post.rating}</Text>
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
              <Text style={styles.clusterPinEmoji}>{categoryEmoji}</Text>
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

  // Group posts by location
  const { singlePosts, clusters } = React.useMemo(() => {
    const groups = new Map<string, any[]>();

    posts.forEach((post: any) => {
      if (post.latitude && post.longitude) {
        const key = `${post.latitude.toFixed(5)},${post.longitude.toFixed(5)}`;
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

    console.log(`📊 Map clustering: ${singlePosts.length} single posts, ${clusters.length} clusters (Platform: ${Platform.OS})`);

    return { singlePosts, clusters };
  }, [posts]);

 // Get category emoji
const getCategoryEmoji = (categoryName: string | null) => {
  if (!categoryName) return null;
  
  
  // Fallback mapping
  const CATEGORY_EMOJIS: { [key: string]: string } = {
    'Vegetarian/Vegan': '🥬',
    'Non vegetarian': '🍖',
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
    'Gujurati': '🥣',
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
  console.log('Selected Category:', selectedCategory, 'Emoji:', categoryEmoji);
  

  return (
    <View style={styles.mapContainer}>
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
            console.log(`🗺️  Rendering ${singlePosts.length} single PostMarkers for filterType: ${filterType}`);
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
  const auth = useAuth() as { user: any; token: string | null; accountType: string | null };
  const { user, token, accountType } = auth;

  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);
  const videoPositions = useRef<Map<string, { top: number; height: number }>>(new Map());
  const cachedMapPosts = useRef<any[]>([]);
  const cachedFollowersPosts = useRef<any[]>([]);
  const cachedUserLocation = useRef<{ latitude: number; longitude: number } | null>(null);

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
  const [mapFilterType, setMapFilterType] = useState<'posts' | 'restaurants' | 'followers'>('posts');
  

  const POSTS_PER_PAGE = 30;
  const CATEGORIES = [
  { id: 'all', name: 'All', emoji: '🍽️' },
  { id: 'vegetarian-vegan', name: 'Vegetarian/Vegan', emoji: '🥬' },
  { id: 'non-vegetarian', name: 'Non vegetarian', emoji: '🍖' },
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
  { id: 'gujarati-style', name: 'Gujurati', emoji: '🥣' },
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
  { id: 'vegetarian-vegan', name: 'Vegetarian/Vegan', emoji: '🥬' },
  { id: 'non-vegetarian', name: 'Non vegetarian', emoji: '🍖' },
  { id: 'dosa', name: 'Dosa', emoji: '🫕' },
  { id: 'tea-coffee', name: 'Tea/Coffee', emoji: '☕' },
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
  { id: 'bengali-style', name: 'Bengali', emoji: '🐟' },
  { id: 'asian', name: 'Asian', emoji: '🥢' },
  { id: 'odia-style', name: 'Odia', emoji: '🍚' },
  { id: 'gujarati-style', name: 'Gujurati', emoji: '🥣' },
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
      console.log("Location permission error:", error);
      return false;
    }
  };

 const getCurrentLocation = async () => {
  try {
    // Return cached location if available (instant!)
    if (cachedUserLocation.current) {
      console.log('Using cached location - instant!');
      setUserLocation(cachedUserLocation.current);
      return cachedUserLocation.current;
    }
    
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    // Try to get last known location first (instant)
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        cachedUserLocation.current = coords;
        setUserLocation(coords);
        console.log('Using last known location - fast!');
        return coords;
      }
    } catch (e) {
      console.log('Last known location not available');
    }

    // Fallback to current position (slower but accurate)
    console.log('Getting fresh GPS location...');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const coords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    // Cache the location
    cachedUserLocation.current = coords;
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


const fetchMapPins = async (searchTerm?: string, forceRefresh = false) => {
  if (!userLocation) return;

  // If we have cached posts and not forcing refresh, use cache
  if (!forceRefresh && !searchTerm && cachedMapPosts.current.length > 0) {
    console.log('Using cached posts:', cachedMapPosts.current.length);
    setMapPosts(cachedMapPosts.current);
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

    console.log('Fetching URL:', url);

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token || ""}` },
    });

    if (searchTerm && searchTerm.trim()) {
      // Search results - don't cache these
      const results = response.data.results || [];
      console.log('Search results:', results.length);
      setMapPosts(results);
      setMapRestaurants([]);
    } else {
      // All pins - cache these
      const posts = response.data.posts || [];
      const restaurants = response.data.restaurants || [];
      console.log('All posts:', posts.length);
      console.log('All restaurants:', restaurants.length);
      
      // Cache the posts
      cachedMapPosts.current = posts;
      
      setMapPosts(posts);
      setMapRestaurants(restaurants);
    }
  } catch (error) {
    console.log("Fetch map pins error:", error);
  } finally {
    setMapLoading(false);
  }
};

// Fetch followers posts for map with caching (NO RADIUS LIMIT - worldwide)
const fetchFollowersPosts = async (forceRefresh = false) => {
  if (!userLocation) {
    console.log('⚠️  Cannot fetch followers posts - no user location');
    return;
  }

  // If we have cached followers posts and not forcing refresh, use cache
  if (!forceRefresh && cachedFollowersPosts.current.length > 0) {
    console.log('✅ Using cached followers posts:', cachedFollowersPosts.current.length);
    setMapPosts(cachedFollowersPosts.current);
    return;
  }

  setMapLoading(true);
  try {
    // No radius limit for followers - show all worldwide
    const url = `${API_URL}/map/followers-posts?lat=${userLocation.latitude}&lng=${userLocation.longitude}`;

    console.log('🔍 Fetching followers posts (worldwide):', url);

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token || ""}` },
    });

    console.log('📦 Followers API response:', response.data);

    const posts = response.data.posts || [];
    const followingCount = response.data.following_count || 0;
    const message = response.data.message || '';

    console.log(`✅ Followers posts received: ${posts.length} posts from ${followingCount} followed users`);
    if (message) console.log(`ℹ️  Message: ${message}`);

    // Cache the followers posts
    cachedFollowersPosts.current = posts;

    setMapPosts(posts);
    setMapRestaurants([]); // Clear restaurants when showing followers
  } catch (error) {
    console.error("❌ Fetch followers posts error:", error);
    // If there's an error, clear the map posts
    setMapPosts([]);
    setMapRestaurants([]);
  } finally {
    setMapLoading(false);
  }
};

const handleQuickCategoryPress = (category: any) => {
  if (selectedQuickCategory === category.id) {
    // Deselect - show all cached posts (NO API CALL)
    setSelectedQuickCategory(null);
    if (activeTab === 'map') {
      // Use cached posts instead of fetching
      console.log('Deselecting category, using cache:', cachedMapPosts.current.length);
      setMapPosts(cachedMapPosts.current);
    } else {
      setAppliedCategories([]);
      setSelectedCategories([]);
      fetchPosts(true, []);
    }
  } else {
    // Select - filter from cached posts (NO API CALL)
    setSelectedQuickCategory(category.id);
    if (activeTab === 'map') {
      // Filter cached posts by category name
      const filteredPosts = cachedMapPosts.current.filter((post: any) => {
  const postCategory = post.category?.toLowerCase().trim();
  const selectedCategoryName = category.name.toLowerCase().trim();
  // Strict match only - exact category or exact substring
  return postCategory === selectedCategoryName;
});
      console.log(`Filtered ${filteredPosts.length} posts for category: ${category.name} (from cache)`);
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
  router.push({
    pathname: "/location-posts",
    params: {
      posts: JSON.stringify(cluster.posts),
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
    }).catch(err => console.log('Analytics tracking error:', err));
    
    // Also track profile visit
    axios.post(`${API_URL}/restaurant/analytics/track`, {
      restaurant_id: restaurant.id,
      event_type: 'profile_visit'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(err => console.log('Analytics tracking error:', err));
  } catch (err) {
    console.log('Analytics tracking error:', err);
  }
  
  router.push(`/restaurant/${restaurant.id}`);
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
      }).catch(err => console.log('Analytics tracking error:', err));
    } catch (err) {
      console.log('Analytics tracking error:', err);
    }
  }
  
  router.push(`/post-details/${post.id}`);
};

  // ======================================================
  // INITIALIZE MAP WHEN TAB CHANGES
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
      console.log('Cache empty, fetching posts...');
      await fetchMapPins(undefined, true); // Force refresh
    }
    // Otherwise, data is already in mapPosts or will be restored from cache
  };
  
  loadMapData();
}, [activeTab, userLocation]);


useFocusEffect(
  useCallback(() => {
    console.log('=== FOCUS EFFECT ===');
    console.log('activeTab:', activeTab);
    console.log('mapPosts.length:', mapPosts.length);
    console.log('cachedMapPosts.length:', cachedMapPosts.current.length);
    console.log('userLocation:', userLocation ? 'yes' : 'no');
    
    // When returning to this screen and map tab is active
    if (activeTab === 'map' && userLocation) {
      if (mapPosts.length === 0 && cachedMapPosts.current.length > 0) {
        // Cache exists but mapPosts is empty (returned from navigation)
        console.log('Restoring from cache on focus...');
        if (selectedQuickCategory) {
          // Re-apply category filter from cache
          const category = QUICK_CATEGORIES.find(c => c.id === selectedQuickCategory);
          if (category) {
            const filteredPosts = cachedMapPosts.current.filter((post: any) => {
  const postCategory = post.category?.toLowerCase().trim();
  const selectedCategoryName = category.name.toLowerCase().trim();
  return postCategory === selectedCategoryName;
});
            setMapPosts(filteredPosts);
          } else {
            setMapPosts(cachedMapPosts.current);
          }
        } else {
          setMapPosts(cachedMapPosts.current);
        }
      } else if (cachedMapPosts.current.length === 0) {
        // No cache exists, need to fetch
        console.log('No cache, fetching...');
        fetchMapPins(undefined, true);
      }
      // If mapPosts.length > 0, do nothing - data already there
    }
    
    // Users tab logic
    if (activeTab === 'users' && posts.length === 0) {
      fetchPosts(true);
    }
    
    return () => setPlayingVideos([]);
  }, [activeTab, userLocation, selectedQuickCategory])
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
  // Only fetch posts for users tab if no posts cached
  if (user && token && activeTab === 'users' && posts.length === 0) {
    fetchPosts(true);
  }
  // DON'T refetch map data on focus - preserve existing data
  return () => setPlayingVideos([]);
}, [user, token, activeTab, posts.length]));

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
  const toggleCategory = (itemName: string) => { 
  setSelectedCategories((prev) => 
    prev.includes(itemName) 
      ? prev.filter((c) => c !== itemName) 
      : [...prev, itemName]
  ); 
};
  const handleLike = async (id: string, liked: boolean) => { setPosts((prev) => prev.map((p) => p.id === id ? { ...p, is_liked: !liked, likes_count: p.likes_count + (liked ? -1 : 1) } : p)); try { liked ? await unlikePost(id) : await likePost(id); } catch (err) { console.log("Like error:", err); } };
  const onRefresh = useCallback(() => { setRefreshing(true); setPlayingVideos([]); fetchPosts(true); }, [appliedCategories]);
  const handlePostPressGrid = async (postId: string) => {
  setPlayingVideos([]);
  
  // Find the post to check if it's a restaurant post
  const post = posts.find(p => p.id === postId);
  if (post && post.account_type === 'restaurant') {
    // Track post click for restaurant
    try {
      const token = await AsyncStorage.getItem('token');
      axios.post(`${API_URL}/restaurant/analytics/track`, {
        restaurant_id: post.user_id,
        event_type: 'post_click',
        post_id: postId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(err => console.log('Analytics tracking error:', err));
    } catch (err) {
      console.log('Analytics tracking error:', err);
    }
  }
  
  router.push(`/post-details/${postId}`);
};

  if (!user || !token) return <View style={styles.center}><ActivityIndicator size="large" color="#4dd0e1" /><Text>Authenticating…</Text></View>;

  const columns = distributePosts(posts);

return (
  <View style={styles.container}>
    <View style={styles.headerContainer}>
      {/* GRADIENT HEADER REMOVED - START DIRECTLY WITH SEARCH */}

      {/* Search Box and Categories - Hidden for restaurant users */}
      {accountType !== 'restaurant' && (
        <>
          {/* Search Box - Now at the top */}
          <View style={styles.searchBoxWrapper}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={performSearch}
              />

              {/* UPDATED CATEGORY BUTTON - NEW BRAND COLORS */}
              <TouchableOpacity onPress={() => setShowCategoryModal(true)} activeOpacity={0.8}>
                <LinearGradient
                  colors={["#FF2E2E", "#FF7A18"]}  // NEW BRAND COLORS
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
        </>
      )}

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
    // Use cached posts instead of fetching
    setMapPosts(cachedMapPosts.current);
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
    onClusterPress={handleClusterPress}
    isLoading={mapLoading}
    mapRef={mapRef}
    filterType={mapFilterType}
    onFilterChange={handleMapFilterChange}
    onCenterLocation={centerOnUserLocation}
    selectedCategory={selectedQuickCategory ? QUICK_CATEGORIES.find(c => c.id === selectedQuickCategory)?.name : null}
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
        <TouchableOpacity style={styles.centerNavItem} onPress={() => router.push("/leaderboard")}><View style={styles.centerIconCircle}><Ionicons name="fast-food" size={22} color="#000" /></View><Text style={styles.navLabel}>{accountType === 'restaurant' ? 'Orders' : 'Delivery'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/happening")}><Ionicons name={accountType === 'restaurant' ? "analytics-outline" : "location-outline"} size={20} color="#000" /><Text style={styles.navLabel}>{accountType === 'restaurant' ? 'Sales' : 'Happening'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/profile")}><Ionicons name="person-outline" size={20} color="#000" /><Text style={styles.navLabel}>Profile</Text></TouchableOpacity>
      </View>

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
              fetchMapPins();
            } else {
              fetchPostsWithCategories([]); 
            }
          } else {
            toggleCategory(item.name); 
          }
        }}
      >
        <View style={styles.categoryItemContent}>
          <Text style={styles.categoryEmoji}>{item.emoji}</Text>
          <Text style={[styles.categoryItemText, isSelected && styles.categoryItemTextSelected]}>
            {item.name}
          </Text>
        </View>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
        ) : (
          <Ionicons name="ellipse-outline" size={24} color="#CCC" />
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
  // For map tab - filter from cache (fast!)
  if (selectedCategories.length > 0) {
    const filteredPosts = cachedMapPosts.current.filter((post: any) => {
      const postCategory = post.category?.toLowerCase().trim();
      return selectedCategories.some(cat => 
        postCategory === cat.toLowerCase().trim()
      );
    });
    console.log(`Modal filter: ${filteredPosts.length} posts for categories: ${selectedCategories.join(', ')}`);
    setMapPosts(filteredPosts);
  } else {
    // No filter - show all cached posts
    setMapPosts(cachedMapPosts.current);
  }
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
  width: 80,  // Increased from 65
  height: 80, // Increased from 65
  borderRadius: 10,
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
},
postMarkerImage: {
  width: 74,
  height: 74,
  borderRadius: 7,
},
postMarkerPlaceholder: {
  width: 74,
  height: 74,
  borderRadius: 7,
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
  borderRadius: 12,
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
  borderRadius: 9,
},
postMarkerPlaceholderAndroid: {
  width: 84,
  height: 84,
  borderRadius: 9,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#F2CF68',
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
  maxHeight: 44,
  marginBottom: 8,
  marginTop: 4,
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
  categoryEmoji: {
  fontSize: 24,
  marginRight: 12,
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