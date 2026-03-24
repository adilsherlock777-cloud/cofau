import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
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
  TextInput,
  Alert,
  Linking,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getSavedPosts, unsavePost } from '../../utils/api';
import { normalizeMediaUrl } from '../../utils/imageUrlFix';
import { Video, ResizeMode } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import axios from 'axios';

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

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_IMAGE_WIDTH = SCREEN_WIDTH * 0.38;
const CARD_HEIGHT = 140;

// Category tabs - matching FOOD_SPOTS from Popular in explore
const CATEGORY_TABS = [
  { id: 'map', label: 'Map', emoji: '__map__', emptyMsg: 'Saved posts with location data will appear here' },
  { id: 'all', label: 'All', emoji: '', emptyMsg: 'Save posts from Explore to see them here' },
  { id: 'restaurant', label: 'Restaurants', emoji: '🍽️', emptyMsg: 'Explore restaurants and save your favourites' },
  { id: 'cafe', label: 'Cafe', emoji: '☕', emptyMsg: 'Discover cafes, fast food spots & save them' },
  { id: 'biryani', label: 'Biryani Spot', emoji: '🍛', emptyMsg: 'Find the best biryani spots and save them' },
  { id: 'pureveg', label: 'Pure Veg', emoji: '__veg__', emptyMsg: 'Explore pure veg places and save your picks' },
  { id: 'nonveg', label: 'Non Veg', emoji: '__nonveg__', emptyMsg: 'Discover non-veg spots and save your favourites' },
  { id: 'arabian', label: 'Arabian', emoji: '🧆', emptyMsg: 'Find Arabian food spots and save them' },
  { id: 'coffeetea', label: 'Coffee/Tea', emoji: '🫖', emptyMsg: 'Explore coffee & tea spots and save them' },
  { id: 'dessert', label: 'Desserts', emoji: '🍰', emptyMsg: 'Discover dessert spots and save your favourites' },
];

// Match a post to a category tab
const matchesCategory = (post: any, categoryId: string): boolean => {
  const cat = (post.category || '').toLowerCase().trim();
  const locName = (post.location_name || '').toLowerCase().trim();
  const dish = (post.dish_name || '').toLowerCase().trim();
  const combined = `${cat} ${locName} ${dish}`;

  switch (categoryId) {
    case 'all':
      return true;
    case 'restaurant':
      return (post.account_type === 'restaurant');
    case 'cafe':
      return combined.includes('cafe') || combined.includes('café') || combined.includes('fast food') || combined.includes('fast-food') || combined.includes('drinks') || combined.includes('soda') || combined.includes('burger') || combined.includes('pizza');
    case 'biryani':
      return combined.includes('biryani');
    case 'pureveg':
      return cat.includes('veg') && !cat.includes('non') || cat.includes('vegetarian') && !cat.includes('non');
    case 'nonveg':
      return cat.includes('non-vegetarian') || cat.includes('nonveg') || cat.includes('non veg') || combined.includes('chicken') || combined.includes('mutton') || combined.includes('fish') || combined.includes('seafood') || combined.includes('bbq') || combined.includes('tandoor');
    case 'arabian':
      return combined.includes('arab') || combined.includes('shawarma') || combined.includes('falafel') || combined.includes('persian');
    case 'coffeetea':
      return combined.includes('coffee') || combined.includes('tea') || combined.includes('tea/coffee') || combined.includes('tea-coffee');
    case 'dessert':
      return combined.includes('dessert') || combined.includes('sweet') || combined.includes('cake') || combined.includes('ice cream') || combined.includes('icecream');
    default:
      return false;
  }
};

// Veg/NonVeg icon helper
const renderCategoryIcon = (emoji: string, size: number, isActive?: boolean) => {
  if (emoji === '__map__') {
    return <Ionicons name="map" size={size} color={isActive ? '#fff' : '#666'} />;
  }
  if (emoji === '__veg__') {
    return (
      <View style={{ width: size, height: size, borderRadius: 3, borderWidth: 1.5, borderColor: '#22C55E', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: size * 0.45, height: size * 0.45, borderRadius: size * 0.45, backgroundColor: '#22C55E' }} />
      </View>
    );
  }
  if (emoji === '__nonveg__') {
    return (
      <View style={{ width: size, height: size, borderRadius: 3, borderWidth: 1.5, borderColor: '#E02D2D', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: size * 0.45, height: size * 0.45, borderRadius: size * 0.45, backgroundColor: '#E02D2D' }} />
      </View>
    );
  }
  if (!emoji) return null;
  return <Text style={{ fontSize: size }}>{emoji}</Text>;
};

// ======================================================
// DASHBOARD COMPONENTS (for restaurant users)
// ======================================================

const StatCard = ({ icon, label, value, color, subtitle }: { icon: string; label: string; value: number; color: string; subtitle?: string; }) => (
  <View style={dashboardStyles.statCard}>
    <View style={[dashboardStyles.statIconContainer, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
    <Text style={dashboardStyles.statValue}>{(value ?? 0).toLocaleString()}</Text>
    <Text style={dashboardStyles.statLabel}>{label}</Text>
    {subtitle && <Text style={dashboardStyles.statSubtitle}>{subtitle}</Text>}
  </View>
);

const LargeStatCard = ({ icon, label, value, color, trend }: { icon: string; label: string; value: number; color: string; trend?: string; }) => (
  <View style={dashboardStyles.largeStatCard}>
    <View style={dashboardStyles.largeStatLeft}>
      <View style={[dashboardStyles.largeStatIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <View style={dashboardStyles.largeStatInfo}>
        <Text style={dashboardStyles.largeStatLabel}>{label}</Text>
        {trend && (
          <View style={dashboardStyles.trendContainer}>
            <Ionicons name="trending-up" size={14} color="#4CAF50" />
            <Text style={dashboardStyles.trendText}>{trend}</Text>
          </View>
        )}
      </View>
    </View>
    <Text style={[dashboardStyles.largeStatValue, { color: color }]}>{(value ?? 0).toLocaleString()}</Text>
  </View>
);

const DashboardContent = memo(({ analytics, loading, onRefresh }: { analytics: any; loading: boolean; onRefresh: () => void }) => {
  if (loading) {
    return (
      <View style={dashboardStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#E94A37" />
        <Text style={dashboardStyles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={dashboardStyles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#E94A37" />}
    >
      {/* Analytics Header */}
      <View style={dashboardStyles.analyticsHeader}>
        <Ionicons name="analytics" size={28} color="#E94A37" />
        <Text style={dashboardStyles.analyticsTitle}>Analytics Overview</Text>
      </View>
      <Text style={dashboardStyles.analyticsSubtitle}>
        Track your restaurant's performance
      </Text>

      {/* Primary Stats - 3 Column Grid */}
      <View style={dashboardStyles.sectionTitle}>
        <Ionicons name="stats-chart" size={20} color="#333" />
        <Text style={dashboardStyles.sectionTitleText}>Key Metrics</Text>
      </View>

      <View style={dashboardStyles.statsGrid}>
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
      <View style={dashboardStyles.sectionTitle}>
        <Ionicons name="eye" size={20} color="#333" />
        <Text style={dashboardStyles.sectionTitleText}>Visibility & Engagement</Text>
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
      <View style={dashboardStyles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#1B7C82" />
        <View style={dashboardStyles.infoContent}>
          <Text style={dashboardStyles.infoTitle}>How to improve?</Text>
          <Text style={dashboardStyles.infoText}>
            Post regularly, respond to reviews, and keep your menu updated to increase visibility and engagement.
          </Text>
        </View>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
});

// ======================================================
// SAVED POST CARD COMPONENT
// ======================================================

const VideoPreview = memo(({ uri, style }: { uri: string; style: any }) => {
  const videoRef = useRef<Video>(null);
  const isSeeking = useRef(false);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded && status.positionMillis >= 3000 && !isSeeking.current) {
      isSeeking.current = true;
      videoRef.current?.setPositionAsync(0)
        .then(() => { isSeeking.current = false; })
        .catch(() => { isSeeking.current = false; });
    }
  }, []);

  return (
    <Video
      ref={videoRef}
      source={{ uri }}
      style={style}
      resizeMode={ResizeMode.COVER}
      shouldPlay
      isMuted
      onPlaybackStatusUpdate={onPlaybackStatusUpdate}
    />
  );
});

// ======================================================
// MAP MARKER COMPONENTS (same logic as explore.tsx)
// ======================================================

const fixUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  let cleaned = url.trim().replace(/([^:]\/)\/+/g, '$1');
  if (!cleaned.startsWith('/')) cleaned = '/' + cleaned;
  return `${API_BASE_URL}${cleaned}`;
};

const PostMarker = memo(({ post, onPress }: any) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTracksChanges(false), Platform.OS === 'android' ? 2000 : 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!post.latitude || !post.longitude) return null;
  const imageUrl = fixUrl(post.thumbnail_url) || fixUrl(post.media_url || post.mediaUrl);
  const viewCount = post.clicks_count || 0;
  const viewCountDisplay = viewCount > 1000 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount;

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
  const [tracksChanges, setTracksChanges] = useState(true);
  const { posts, latitude, longitude, count } = cluster;
  const latestPosts = [...posts]
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 3);

  useEffect(() => {
    const timer = setTimeout(() => setTracksChanges(false), Platform.OS === 'android' ? 2000 : 5000);
    return () => clearTimeout(timer);
  }, []);

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
                  source={{ uri: (fixUrl(post.thumbnail_url) || fixUrl(post.media_url))! }}
                  style={mapStyles.clusterImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
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

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {}
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

const SavedPostCard = memo(({ post, onUnsave, onPress }: { post: any; onUnsave: (id: string) => void; onPress: (id: string) => void }) => {
  const mediaUrl = normalizeMediaUrl(post.media_url || post.mediaUrl);
  const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
  const isVideo =
    post.media_type === 'video' ||
    mediaUrl?.toLowerCase().endsWith('.mp4') ||
    mediaUrl?.toLowerCase().endsWith('.mov') ||
    mediaUrl?.toLowerCase().endsWith('.avi') ||
    mediaUrl?.toLowerCase().endsWith('.webm');

  const handleDirection = () => {
    if (post.map_link) {
      Linking.openURL(post.map_link);
    } else if (post.location_name) {
      const query = encodeURIComponent(post.location_name);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    }
  };

  const handleUnsave = () => {
    Alert.alert(
      'Unsave Post',
      'Do you want to unsave this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Unsave',
          style: 'destructive',
          onPress: () => onUnsave(post._id || post.id),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress(post._id || post.id)}
    >
      {/* Image/Video Section - 40% left */}
      <View style={styles.cardImageContainer}>
        {isVideo && mediaUrl ? (
          <VideoPreview uri={mediaUrl} style={styles.cardImage} />
        ) : mediaUrl ? (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={32} color="#ccc" />
          </View>
        )}
        {isVideo && mediaUrl && (
          <View style={styles.videoIcon}>
            <Ionicons name="videocam" size={16} color="#fff" />
          </View>
        )}
        {post.dish_name && (
          <View style={styles.dishTag}>
            <Text style={styles.dishTagText} numberOfLines={1}>{post.dish_name}</Text>
          </View>
        )}
      </View>

      {/* Details Section - 60% right */}
      <View style={styles.cardDetails}>
        {/* Unsave button - top right */}
        <TouchableOpacity style={styles.unsaveButton} onPress={handleUnsave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="bookmark" size={20} color="#E94A37" />
        </TouchableOpacity>

        {/* Location info */}
        <View style={styles.locationInfo}>
          <Ionicons name="location-sharp" size={16} color="#E94A37" />
          <Text style={styles.locationName} numberOfLines={2}>
            {post.location_name || 'Unknown Location'}
          </Text>
        </View>

        {/* Category tag */}
        {post.category && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText} numberOfLines={1}>{post.category}</Text>
          </View>
        )}

        {/* Review snippet */}
        {post.review_text ? (
          <Text style={styles.reviewSnippet} numberOfLines={1}>
            {post.review_text}
          </Text>
        ) : null}

        {/* Direction button */}
        <TouchableOpacity style={styles.directionButton} onPress={handleDirection} activeOpacity={0.7}>
          <Ionicons name="navigate" size={14} color="#fff" />
          <Text style={styles.directionButtonText}>Directions</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

// ======================================================
// MAIN SCREEN
// ======================================================

export default function SavedLocationsScreen() {
  const router = useRouter();
  const auth = useAuth() as any;
  const { token, accountType } = auth;
  const isRestaurant = accountType === 'restaurant';

  // Saved posts state (for regular users)
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('map');
  const [mapFilter, setMapFilter] = useState<'users' | 'restaurants'>('users');
  const mapRef = useRef<any>(null);

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

  useEffect(() => {
    if (isRestaurant && token) {
      fetchAnalytics();
    } else if (!isRestaurant) {
      fetchSaved();
    }
  }, [isRestaurant, token]);

  // Refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      if (isRestaurant && token) {
        fetchAnalytics();
      } else if (!isRestaurant && !loading) {
        fetchSaved();
      }
    }, [isRestaurant, token])
  );

  const fetchAnalytics = async () => {
    if (accountType !== 'restaurant' || !token) return;

    setDashboardLoading(true);
    try {
      const response = await axios.get(`${API_URL}/restaurant/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      console.error('Error fetching analytics:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

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

  const handleUnsave = async (postId: string) => {
    // Optimistic removal
    const prevPosts = savedPosts;
    setSavedPosts(posts => posts.filter(p => (p._id || p.id) !== postId));
    try {
      await unsavePost(postId);
    } catch {
      // Revert on error
      setSavedPosts(prevPosts);
    }
  };

  const handlePostPress = (postId: string) => {
    // Track post click for restaurant posts
    const post = savedPosts.find(p => (p._id || p.id) === postId);
    if (post && post.account_type === 'restaurant') {
      const restaurantId = post.restaurant_id || post.user_id;
      if (restaurantId && token) {
        axios.post(`${API_URL}/restaurant/analytics/track`, {
          restaurant_id: restaurantId,
          event_type: 'post_click',
          post_id: postId,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    }
    router.push(`/post-details/${postId}`);
  };

  // Filter posts by category and search query
  const filteredPosts = useMemo(() => {
    let posts = [...savedPosts];

    // Sort latest to oldest
    posts.sort((a, b) => {
      const dateA = new Date(a.saved_at || a.created_at || 0).getTime();
      const dateB = new Date(b.saved_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    // Category filter
    if (activeCategory !== 'all') {
      posts = posts.filter(post => matchesCategory(post, activeCategory));
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      posts = posts.filter(post => {
        const name = (post.location_name || '').toLowerCase();
        const dish = (post.dish_name || '').toLowerCase();
        const review = (post.review_text || '').toLowerCase();
        const cat = (post.category || '').toLowerCase();
        return name.includes(q) || dish.includes(q) || review.includes(q) || cat.includes(q);
      });
    }

    return posts;
  }, [savedPosts, activeCategory, searchQuery]);

  // Count posts per category for tab badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORY_TABS.forEach(tab => {
      counts[tab.id] = tab.id === 'all'
        ? savedPosts.length
        : savedPosts.filter(post => matchesCategory(post, tab.id)).length;
    });
    return counts;
  }, [savedPosts]);

  // Posts with valid coordinates for map, filtered by mapFilter
  const postsWithCoords = useMemo(() =>
    savedPosts.filter(p => {
      if (!p.latitude || !p.longitude) return false;
      if (mapFilter === 'restaurants') return p.account_type === 'restaurant';
      return p.account_type !== 'restaurant';
    }),
    [savedPosts, mapFilter]
  );

  // Counts for map sub-tabs
  const mapUserCount = useMemo(() =>
    savedPosts.filter(p => p.latitude && p.longitude && p.account_type !== 'restaurant').length,
    [savedPosts]
  );
  const mapRestaurantCount = useMemo(() =>
    savedPosts.filter(p => p.latitude && p.longitude && p.account_type === 'restaurant').length,
    [savedPosts]
  );

  // Group posts by location for map markers (same toFixed(3) logic as explore.tsx)
  const { singlePosts, clusters } = useMemo(() => {
    const groups = new Map<string, any[]>();
    postsWithCoords.forEach((post: any) => {
      const key = `${post.latitude.toFixed(3)},${post.longitude.toFixed(3)}`;
      if (!groups.has(key)) groups.set(key, []);
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
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) * 1.3, 0.02),
      longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.3, 0.02),
    };
  }, [postsWithCoords]);

  const handlePostMarkerPress = (post: any) => {
    // Track post click for restaurant posts from map
    if (post.account_type === 'restaurant') {
      const restaurantId = post.restaurant_id || post.user_id;
      const postId = post._id || post.id;
      if (restaurantId && token) {
        axios.post(`${API_URL}/restaurant/analytics/track`, {
          restaurant_id: restaurantId,
          event_type: 'post_click',
          post_id: postId,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    }
    router.push(`/post-details/${post._id || post.id}`);
  };

  const handleClusterPress = (cluster: any) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  // ======================================================
  // RESTAURANT USER: DASHBOARD VIEW
  // ======================================================
  if (isRestaurant) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaskedView
            maskElement={
              <Text style={styles.headerTitleLobster}>Dashboard</Text>
            }
          >
            <LinearGradient
              colors={['#FF2E2E', '#FF7A18']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.headerTitleLobster, { opacity: 0 }]}>Dashboard</Text>
            </LinearGradient>
          </MaskedView>
          <View style={styles.subtitleRow}>
            <Ionicons name="analytics" size={16} color="#E94A37" />
            <Text style={styles.titleSub}>Your restaurant analytics</Text>
          </View>
        </View>
        <DashboardContent
          analytics={analytics}
          loading={dashboardLoading}
          onRefresh={fetchAnalytics}
        />
      </View>
    );
  }

  // ======================================================
  // REGULAR USER: SAVED POSTS VIEW
  // ======================================================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <MaskedView
          maskElement={
            <Text style={styles.headerTitleLobster}>Saved</Text>
          }
        >
          <LinearGradient
            colors={['#FF2E2E', '#FF7A18']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.headerTitleLobster, { opacity: 0 }]}>Saved</Text>
          </LinearGradient>
        </MaskedView>
        <View style={styles.subtitleRow}>
          <Ionicons name="bookmark" size={16} color="#E94A37" />
          <Text style={styles.titleSub}>Your saved posts</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search saved places, dishes..."
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
        {CATEGORY_TABS.map(tab => {
          const isActive = activeCategory === tab.id;
          const count = categoryCounts[tab.id] || 0;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveCategory(tab.id)}
              activeOpacity={0.7}
            >
              {isActive ? (
                <LinearGradient
                  colors={['#FF2E2E', '#FF7A18']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabGradient}
                >
                  {tab.emoji ? renderCategoryIcon(tab.emoji, 14, true) : null}
                  <Text style={styles.tabTextActive}>{tab.label}</Text>
                  {count > 0 && tab.id !== 'map' && <Text style={styles.tabCountActive}>{count}</Text>}
                </LinearGradient>
              ) : (
                <View style={styles.tabInner}>
                  {tab.emoji ? renderCategoryIcon(tab.emoji, 14, false) : null}
                  <Text style={styles.tabText}>{tab.label}</Text>
                  {count > 0 && tab.id !== 'map' && <Text style={styles.tabCount}>{count}</Text>}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E94A37" />
        </View>
      ) : activeCategory === 'map' ? (
        /* Map View - always show map like explore.tsx */
        <View style={{ flex: 1 }}>
          <View style={mapStyles.mapContainer}>
            <MapErrorBoundary>
              <MapView
                ref={mapRef}
                style={mapStyles.map}
                initialRegion={mapRegion || {
                  latitude: 17.385,
                  longitude: 78.4867,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5,
                }}
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

            {/* Users / Restaurants sub-tabs */}
            <View style={mapStyles.mapSubTabsContainer}>
              <TouchableOpacity
                style={[mapStyles.mapSubTab, mapFilter === 'users' && mapStyles.mapSubTabActive]}
                onPress={() => setMapFilter('users')}
                activeOpacity={0.7}
              >
                <Ionicons name="person" size={14} color={mapFilter === 'users' ? '#fff' : '#666'} />
                <Text style={[mapStyles.mapSubTabText, mapFilter === 'users' && mapStyles.mapSubTabTextActive]}>
                  Users {mapUserCount > 0 ? `(${mapUserCount})` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mapStyles.mapSubTab, mapFilter === 'restaurants' && mapStyles.mapSubTabActive]}
                onPress={() => setMapFilter('restaurants')}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14 }}>🍽️</Text>
                <Text style={[mapStyles.mapSubTabText, mapFilter === 'restaurants' && mapStyles.mapSubTabTextActive]}>
                  Restaurants {mapRestaurantCount > 0 ? `(${mapRestaurantCount})` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={mapStyles.resultsCountContainer}>
              <Text style={mapStyles.resultsCountText}>
                {postsWithCoords.length} saved {postsWithCoords.length === 1 ? 'place' : 'places'}{postsWithCoords.length > 0 ? ` at ${singlePosts.length + clusters.length} ${singlePosts.length + clusters.length === 1 ? 'location' : 'locations'}` : ''}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={item => item._id || item.id}
          renderItem={({ item }) => (
            <SavedPostCard
              post={item}
              onUnsave={handleUnsave}
              onPress={handlePostPress}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E94A37" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={70} color="#ddd" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No results found' : 'No Saved Posts'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try a different search term'
                  : CATEGORY_TABS.find(t => t.id === activeCategory)?.emptyMsg || 'Save posts to see your favorite places here'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={styles.exploreButton}
                  onPress={() => router.push('/(tabs)/explore')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="compass-outline" size={16} color="#fff" />
                  <Text style={styles.exploreButtonText}>Explore & Save</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

// ======================================================
// SAVED VIEW STYLES
// ======================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 14,
    backgroundColor: '#fff',
  },
  headerTitleLobster: {
    fontFamily: 'Lobster',
    fontSize: 36,
    letterSpacing: 1,
    textAlign: 'center',
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

  // Search bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },

  // Category tabs
  tabsWrapper: {
    height: 52,
    marginTop: 10,
    marginBottom: 4,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    height: 52,
  },
  tab: {
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  tabActive: {
    borderColor: 'transparent',
    borderWidth: 0,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 6,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 25,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabCountActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E94A37',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Post list
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    height: CARD_HEIGHT,
  },
  cardImageContainer: {
    width: CARD_IMAGE_WIDTH,
    height: '100%',
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  videoIcon: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: 2,
  },
  dishTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(233, 74, 55, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '85%',
  },
  dishTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Card details (right side)
  cardDetails: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  unsaveButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingRight: 28,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    flex: 1,
    lineHeight: 18,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#888',
  },
  reviewSnippet: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  directionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E94A37',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
    marginTop: 4,
  },
  directionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Loading & empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#444',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E94A37',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 18,
    gap: 6,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

// ======================================================
// DASHBOARD STYLES (for restaurant users)
// ======================================================
const dashboardStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  analyticsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  analyticsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 20,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
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
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  largeStatCard: {
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
  largeStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  largeStatIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeStatInfo: {
    gap: 4,
  },
  largeStatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  largeStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E8F5F5',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1B7C82',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B7C82',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});

// ======================================================
// MAP STYLES (matching explore.tsx)
// ======================================================
const mapStyles = StyleSheet.create({
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1, width: '100%', height: '100%' },
  mapSubTabsContainer: {
    position: 'absolute', top: 12, left: 16, right: 16,
    flexDirection: 'row', gap: 8, justifyContent: 'center',
  },
  mapSubTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  mapSubTabActive: {
    backgroundColor: '#E94A37',
  },
  mapSubTabText: {
    fontSize: 13, fontWeight: '600', color: '#666',
  },
  mapSubTabTextActive: {
    color: '#fff',
  },
  resultsCountContainer: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center',
  },
  resultsCountText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  postMarkerContainer: { alignItems: 'center' },
  postMarkerBubble: {
    width: 56, height: 56, borderRadius: 8, backgroundColor: '#F2CF68',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  postMarkerImage: { width: 50, height: 50, borderRadius: 6 },
  postMarkerPlaceholder: { width: 50, height: 50, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2CF68' },
  postMarkerArrow: {
    width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fff', marginTop: -2,
  },
  markerViewsBadge: {
    position: 'absolute', bottom: 2, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, gap: 2,
  },
  markerViewsText: { color: '#fff', fontSize: 7, fontWeight: '600' },
  clusterMarkerContainer: { alignItems: 'center' },
  clusterPreviewContainer: { position: 'relative', height: 60, marginBottom: -10 },
  clusterPreviewImage: {
    width: 60, height: 60, borderRadius: 10, borderWidth: 3, borderColor: '#fff', backgroundColor: '#f0f0f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  clusterImage: { width: 54, height: 54, borderRadius: 7 },
  clusterImagePlaceholder: { width: 54, height: 54, borderRadius: 7, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  clusterPinContainer: { alignItems: 'center' },
  clusterPin: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#E94A37',
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  clusterCountBadge: {
    position: 'absolute', top: -5, right: -10, backgroundColor: '#fff', borderRadius: 12,
    minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E94A37', paddingHorizontal: 6,
  },
  clusterCountText: { color: '#E94A37', fontSize: 12, fontWeight: 'bold' },
  clusterPinArrow: {
    width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fff', marginTop: -3,
  },
});
