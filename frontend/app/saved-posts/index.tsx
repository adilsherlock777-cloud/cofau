import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getSavedPosts, unsavePost } from '../../utils/api';
import { normalizeMediaUrl } from '../../utils/imageUrlFix';
import { Image as ExpoImage } from 'expo-image';

let MapView: any;
let Marker: any;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  MapView = ({ children, style, ...props }: any) => (
    <View style={[style, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
      <Text>Maps not available in Expo Go</Text>
    </View>
  );
  Marker = View;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';

const fixUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  let cleaned = url.trim().replace(/([^:]\/)\/+/g, '$1');
  if (!cleaned.startsWith('/')) cleaned = '/' + cleaned;
  return `${API_BASE_URL}${cleaned}`;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - 6) / 3; // 3 columns with 2px gaps

type FilterTab = 'map' | 'all' | 'users' | 'restaurants';

// ======================================================
// MAP MARKER COMPONENTS (same logic as explore.tsx)
// ======================================================

const PostMarker = memo(({ post, onPress }: any) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, Platform.OS === 'android' ? 2000 : 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!post.latitude || !post.longitude) return null;

  const imageUrl = fixUrl(post.thumbnail_url) || fixUrl(post.media_url || post.mediaUrl);
  const viewCount = post.clicks_count || 0;
  const viewCountDisplay = viewCount > 1000 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount;

  if (Platform.OS === 'android') {
    return (
      <Marker
        coordinate={{ latitude: post.latitude, longitude: post.longitude }}
        onPress={() => onPress(post)}
        tracksViewChanges={tracksChanges && !imageLoaded}
      >
        <View style={{ backgroundColor: '#FFFFFF', padding: 3, elevation: 5 }}>
          {imageUrl ? (
            <ExpoImage
              source={{ uri: imageUrl }}
              style={{ width: 60, height: 60 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => { setImageLoaded(true); setTracksChanges(false); }}
            />
          ) : (
            <View style={{ width: 60, height: 60, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="image" size={24} color="#fff" />
            </View>
          )}
          <View style={mapStyles.markerViewsBadge}>
            <Ionicons name="eye" size={8} color="#fff" />
            <Text style={mapStyles.markerViewsText}>{viewCountDisplay}</Text>
          </View>
        </View>
      </Marker>
    );
  }

  return (
    <Marker
      coordinate={{ latitude: post.latitude, longitude: post.longitude }}
      onPress={(e: any) => { e?.stopPropagation?.(); onPress(post); }}
      tracksViewChanges={tracksChanges && !imageLoaded}
      stopPropagation={true}
    >
      <View style={mapStyles.postMarkerContainer}>
        <View style={mapStyles.postMarkerBubble}>
          {imageUrl ? (
            <ExpoImage
              source={{ uri: imageUrl }}
              style={mapStyles.postMarkerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <View style={mapStyles.postMarkerPlaceholder}>
              <Ionicons name="image" size={24} color="#fff" />
            </View>
          )}
          <View style={mapStyles.markerViewsBadge}>
            <Ionicons name="eye" size={8} color="#fff" />
            <Text style={mapStyles.markerViewsText}>{viewCountDisplay}</Text>
          </View>
        </View>
        <View style={mapStyles.postMarkerArrow} />
      </View>
    </Marker>
  );
});

const ClusterMarker = memo(({ cluster, onPress }: any) => {
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [tracksChanges, setTracksChanges] = useState(true);
  const { posts, latitude, longitude, count } = cluster;

  const latestPosts = [...posts]
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 3);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTracksChanges(false);
    }, Platform.OS === 'android' ? 2000 : 5000);
    return () => clearTimeout(timer);
  }, []);

  if (Platform.OS === 'android') {
    const image1 = fixUrl(latestPosts[0]?.thumbnail_url) || fixUrl(latestPosts[0]?.media_url);
    const image2 = fixUrl(latestPosts[1]?.thumbnail_url) || fixUrl(latestPosts[1]?.media_url);

    return (
      <Marker
        coordinate={{ latitude, longitude }}
        onPress={() => onPress(cluster)}
        tracksViewChanges={tracksChanges}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {image2 && (
            <View style={{ backgroundColor: '#FFFFFF', padding: 2, elevation: 4, marginRight: -20 }}>
              <ExpoImage
                source={{ uri: image2 }}
                style={{ width: 50, height: 50 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                onLoad={() => setImagesLoaded(prev => prev + 1)}
              />
              <View style={mapStyles.markerViewsBadge}>
                <Ionicons name="eye" size={8} color="#fff" />
                <Text style={mapStyles.markerViewsText}>
                  {(latestPosts[1]?.clicks_count || 0) > 1000
                    ? `${((latestPosts[1]?.clicks_count || 0) / 1000).toFixed(1)}K`
                    : (latestPosts[1]?.clicks_count || 0)}
                </Text>
              </View>
            </View>
          )}
          <View style={{ backgroundColor: '#FFFFFF', padding: 2, elevation: 6 }}>
            {image1 ? (
              <ExpoImage
                source={{ uri: image1 }}
                style={{ width: 50, height: 50 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                onLoad={() => { setImagesLoaded(prev => prev + 1); setTracksChanges(false); }}
              />
            ) : (
              <View style={{ width: 50, height: 50, backgroundColor: '#E94A37', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="image" size={20} color="#fff" />
              </View>
            )}
            <View style={mapStyles.markerViewsBadge}>
              <Ionicons name="eye" size={8} color="#fff" />
              <Text style={mapStyles.markerViewsText}>
                {(latestPosts[0]?.clicks_count || 0) > 1000
                  ? `${((latestPosts[0]?.clicks_count || 0) / 1000).toFixed(1)}K`
                  : (latestPosts[0]?.clicks_count || 0)}
              </Text>
            </View>
          </View>
          <View style={{
            backgroundColor: '#E94A37', borderRadius: 12, minWidth: 24, height: 24,
            justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
            marginLeft: -12, marginTop: -30, elevation: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{count}</Text>
          </View>
        </View>
      </Marker>
    );
  }

  const clusterWidth = 60 + (latestPosts.length - 1) * 45;
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={(e: any) => { e?.stopPropagation?.(); onPress(cluster); }}
      tracksViewChanges={tracksChanges}
      zIndex={1000 + count}
      stopPropagation={true}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={[mapStyles.clusterMarkerContainer, { width: clusterWidth }]}>
        <View style={[mapStyles.clusterPreviewContainer, { width: clusterWidth }]}>
          {latestPosts.map((post: any, index: number) => (
            <View
              key={post._id || post.id}
              style={[
                mapStyles.clusterPreviewImage,
                { position: 'absolute', left: index * 45, zIndex: 3 - index, elevation: 4 + (3 - index) }
              ]}
            >
              {fixUrl(post.thumbnail_url) || fixUrl(post.media_url) ? (
                <ExpoImage
                  source={{ uri: fixUrl(post.thumbnail_url) || fixUrl(post.media_url) }}
                  style={mapStyles.clusterImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  onLoad={() => setImagesLoaded(prev => prev + 1)}
                />
              ) : (
                <View style={mapStyles.clusterImagePlaceholder}>
                  <Ionicons name="image" size={16} color="#fff" />
                </View>
              )}
              <View style={mapStyles.markerViewsBadge}>
                <Ionicons name="eye" size={8} color="#fff" />
                <Text style={mapStyles.markerViewsText}>
                  {(post.clicks_count || 0) > 1000
                    ? `${((post.clicks_count || 0) / 1000).toFixed(1)}K`
                    : (post.clicks_count || 0)}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={mapStyles.clusterPinContainer}>
          <View style={mapStyles.clusterPin}>
            <Ionicons name="location" size={18} color="#fff" />
          </View>
          <View style={mapStyles.clusterCountBadge}>
            <Text style={mapStyles.clusterCountText}>{count}</Text>
          </View>
          <View style={mapStyles.clusterPinArrow} />
        </View>
      </View>
    </Marker>
  );
});

// Error boundary for map crashes
class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {}
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

// ======================================================
// MAIN SCREEN
// ======================================================

export default function SavedPostsScreen() {
  const router = useRouter();
  const auth = useAuth() as any;
  const { token } = auth;

  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('map');
  const mapRef = useRef<any>(null);

  useEffect(() => {
    fetchSaved();
  }, []);

  const fetchSaved = async () => {
    try {
      setLoading(true);
      const data = await getSavedPosts();
      setSavedPosts(data);
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSaved();
    setRefreshing(false);
  };

  // Filter posts by tab (map uses all saved posts)
  const filteredPosts = useMemo(() => {
    if (activeFilter === 'map' || activeFilter === 'all') return savedPosts;
    if (activeFilter === 'restaurants') return savedPosts.filter(p => p.account_type === 'restaurant');
    return savedPosts.filter(p => p.account_type !== 'restaurant');
  }, [savedPosts, activeFilter]);

  // Counts for tab badges
  const userCount = useMemo(() => savedPosts.filter(p => p.account_type !== 'restaurant').length, [savedPosts]);
  const restaurantCount = useMemo(() => savedPosts.filter(p => p.account_type === 'restaurant').length, [savedPosts]);

  // Posts with valid coordinates for map
  const postsWithCoords = useMemo(() =>
    savedPosts.filter(p => p.latitude && p.longitude),
    [savedPosts]
  );

  // Group posts by location for map markers (same toFixed(3) logic as explore.tsx)
  const { singlePosts, clusters } = useMemo(() => {
    const groups = new Map<string, any[]>();

    postsWithCoords.forEach((post: any) => {
      const key = `${post.latitude.toFixed(3)},${post.longitude.toFixed(3)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(post);
    });

    const singlePosts: any[] = [];
    const clusters: any[] = [];

    groups.forEach((groupPosts, key) => {
      const [lat, lng] = key.split(',').map(Number);
      groupPosts.sort((a: any, b: any) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
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
  }, [postsWithCoords]);

  // Calculate map initial region from saved posts
  const mapRegion = useMemo(() => {
    if (postsWithCoords.length === 0) return null;

    const lats = postsWithCoords.map(p => p.latitude);
    const lngs = postsWithCoords.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = Math.max((maxLat - minLat) * 1.3, 0.02);
    const lngDelta = Math.max((maxLng - minLng) * 1.3, 0.02);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [postsWithCoords]);

  // Group posts by location, sorted latest to oldest
  const groupedByLocation = useMemo(() => {
    const groups: Record<string, any[]> = {};

    for (const post of filteredPosts) {
      const location = post.location_name?.trim() || 'Other';
      if (!groups[location]) {
        groups[location] = [];
      }
      groups[location].push(post);
    }

    const sortedEntries = Object.entries(groups).sort(([, postsA], [, postsB]) => {
      const dateA = new Date(postsA[0]?.saved_at || postsA[0]?.created_at || 0).getTime();
      const dateB = new Date(postsB[0]?.saved_at || postsB[0]?.created_at || 0).getTime();
      return dateB - dateA;
    });

    return sortedEntries;
  }, [filteredPosts]);

  const handlePostMarkerPress = (post: any) => {
    router.push(`/post-details/${post._id || post.id}`);
  };

  const handleClusterPress = (cluster: any) => {
    // Zoom into the cluster location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const handleUnsave = (postId: string) => {
    Alert.alert(
      'Unsave Post',
      'Do you want to unsave this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Unsave',
          style: 'destructive',
          onPress: async () => {
            const prevPosts = savedPosts;
            setSavedPosts(posts => posts.filter(p => (p._id || p.id) !== postId));
            try {
              await unsavePost(postId);
            } catch {
              setSavedPosts(prevPosts);
            }
          },
        },
      ]
    );
  };

  const renderPost = (post: any) => {
    const mediaUrl = normalizeMediaUrl(post.media_url || post.mediaUrl);
    const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
    const isVideo =
      post.media_type === 'video' ||
      mediaUrl?.toLowerCase().endsWith('.mp4') ||
      mediaUrl?.toLowerCase().endsWith('.mov') ||
      mediaUrl?.toLowerCase().endsWith('.avi') ||
      mediaUrl?.toLowerCase().endsWith('.webm');

    const displayUrl = isVideo ? thumbnailUrl : mediaUrl;
    const hasValidThumbnail = isVideo ? !!thumbnailUrl : !!mediaUrl;

    return (
      <TouchableOpacity
        key={post._id || post.id}
        style={styles.gridItem}
        onPress={() => router.push(`/post-details/${post._id || post.id}`)}
        activeOpacity={0.8}
      >
        {hasValidThumbnail && displayUrl ? (
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: displayUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={(error) => {
                console.error("Image load error in saved posts:", displayUrl, error);
              }}
            />
            {isVideo && (
              <View style={styles.videoOverlay}>
                <Ionicons name="play-circle" size={40} color="#fff" />
              </View>
            )}
            {post.dish_name && (
              <View style={styles.dishNameTag}>
                <Text style={styles.dishNameText} numberOfLines={1}>{post.dish_name.toUpperCase()}</Text>
              </View>
            )}
            {post.account_type === 'restaurant' && (
              <View style={styles.restaurantBadge}>
                <Ionicons name="restaurant" size={10} color="#fff" />
              </View>
            )}
            <TouchableOpacity
              style={styles.unsaveButton}
              onPress={(e) => { e.stopPropagation(); handleUnsave(post._id || post.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="bookmark" size={18} color="#E94A37" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons
              name={isVideo ? 'videocam-outline' : 'image-outline'}
              size={40}
              color="#ccc"
            />
            {isVideo && !thumbnailUrl && (
              <Text style={styles.placeholderText}>Video</Text>
            )}
            <TouchableOpacity
              style={styles.unsaveButton}
              onPress={(e) => { e.stopPropagation(); handleUnsave(post._id || post.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="bookmark" size={18} color="#E94A37" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFilterTab = (tab: FilterTab, label: string, count: number) => {
    const isActive = activeFilter === tab;
    const isMapTab = tab === 'map';
    return (
      <TouchableOpacity
        key={tab}
        style={styles.filterTab}
        onPress={() => setActiveFilter(tab)}
        activeOpacity={0.7}
      >
        {isMapTab ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="map" size={16} color={isActive ? '#222' : '#999'} />
            <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
              Map
            </Text>
          </View>
        ) : (
          <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
            {label}{count > 0 ? ` (${count})` : ''}
          </Text>
        )}
        {isActive && (
          <LinearGradient
            colors={['#FF2E2E', '#FF7A18']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.filterTabIndicator}
          />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saved Posts</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Posts</Text>
        <View style={styles.backButton} />
      </View>

      {/* Filter Tabs: Map | All | Users | Restaurants */}
      <View style={styles.filterBar}>
        {renderFilterTab('map', 'Map', 0)}
        {renderFilterTab('all', 'All', savedPosts.length)}
        {renderFilterTab('users', 'Users', userCount)}
        {renderFilterTab('restaurants', 'Restaurants', restaurantCount)}
      </View>

      {activeFilter === 'map' ? (
        /* Map View */
        <View style={{ flex: 1 }}>
          {postsWithCoords.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={80} color="#ccc" />
              <Text style={styles.emptyTitle}>No Saved Places on Map</Text>
              <Text style={styles.emptySubtitle}>
                Saved posts with location data will appear here
              </Text>
            </View>
          ) : (
            <View style={mapStyles.mapContainer}>
              <MapErrorBoundary>
                <MapView
                  ref={mapRef}
                  style={mapStyles.map}
                  initialRegion={mapRegion}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                  showsCompass={true}
                >
                  {singlePosts.map((post: any) => (
                    <PostMarker
                      key={`saved-post-${post._id || post.id}`}
                      post={post}
                      onPress={handlePostMarkerPress}
                    />
                  ))}
                  {clusters.map((cluster: any) => (
                    <ClusterMarker
                      key={`saved-cluster-${cluster.id}`}
                      cluster={cluster}
                      onPress={handleClusterPress}
                    />
                  ))}
                </MapView>
              </MapErrorBoundary>

              {/* Results Count */}
              <View style={mapStyles.resultsCountContainer}>
                <Text style={mapStyles.resultsCountText}>
                  {postsWithCoords.length} saved {postsWithCoords.length === 1 ? 'place' : 'places'} at {singlePosts.length + clusters.length} {singlePosts.length + clusters.length === 1 ? 'location' : 'locations'}
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        /* List View (All / Users / Restaurants) */
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeFilter === 'restaurants' ? 'restaurant-outline' : 'bookmark-outline'}
                size={80}
                color="#ccc"
              />
              <Text style={styles.emptyTitle}>
                {activeFilter === 'all' ? 'No Saved Posts' :
                 activeFilter === 'restaurants' ? 'No Saved Restaurant Posts' :
                 'No Saved User Posts'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'all'
                  ? 'Save posts you want to see again'
                  : `No ${activeFilter === 'restaurants' ? 'restaurant' : 'user'} posts saved yet`}
              </Text>
            </View>
          ) : (
            <View style={styles.locationList}>
              {groupedByLocation.map(([location, posts]) => (
                <View key={location} style={styles.locationSection}>
                  <View style={styles.locationHeader}>
                    <Ionicons name="location-sharp" size={18} color="#E74C3C" />
                    <Text style={styles.locationTitle}>{location}</Text>
                    <Text style={styles.locationCount}>
                      {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                    </Text>
                  </View>
                  <View style={styles.gridContainer}>
                    {posts.map(renderPost)}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ======================================================
// MAP STYLES (matching explore.tsx)
// ======================================================

const mapStyles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  // PostMarker styles
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
  markerViewsBadge: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    gap: 2,
  },
  markerViewsText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '600',
  },
  // ClusterMarker styles
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
});

// ======================================================
// SCREEN STYLES
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  filterTabTextActive: {
    color: '#222',
    fontWeight: '600',
  },
  filterTabIndicator: {
    height: 2.5,
    width: '60%',
    borderRadius: 2,
    marginTop: 6,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationList: {
    paddingBottom: 20,
  },
  locationSection: {
    marginBottom: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginLeft: 8,
    flex: 1,
  },
  locationCount: {
    fontSize: 13,
    color: '#888',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    position: 'relative',
  },
  thumbnailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dishNameTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(233, 74, 55, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    maxWidth: '75%',
  },
  dishNameText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  restaurantBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 122, 24, 0.85)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unsaveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
