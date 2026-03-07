import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_IMAGE_WIDTH = SCREEN_WIDTH * 0.38;
const CARD_HEIGHT = 140;

// Category tabs - similar to FOOD_SPOTS in explore
const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'cafe', label: 'Cafe' },
  { id: 'biryani', label: 'Biryani' },
  { id: 'pureveg', label: 'Veg' },
  { id: 'nonveg', label: 'Non Veg' },
];

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

const SavedPostCard = memo(({ post, onUnsave, onPress }: { post: any; onUnsave: (id: string) => void; onPress: (id: string) => void }) => {
  const mediaUrl = normalizeMediaUrl(post.media_url || post.mediaUrl);
  const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
  const isVideo =
    post.media_type === 'video' ||
    mediaUrl?.toLowerCase().endsWith('.mp4') ||
    mediaUrl?.toLowerCase().endsWith('.mov') ||
    mediaUrl?.toLowerCase().endsWith('.avi') ||
    mediaUrl?.toLowerCase().endsWith('.webm');

  const displayUrl = isVideo ? (thumbnailUrl || mediaUrl) : mediaUrl;

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
      {/* Image Section - 40% left */}
      <View style={styles.cardImageContainer}>
        {displayUrl ? (
          <Image
            source={{ uri: displayUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={32} color="#ccc" />
          </View>
        )}
        {isVideo && displayUrl && (
          <View style={styles.videoIcon}>
            <Ionicons name="play-circle" size={24} color="#fff" />
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
  const [activeCategory, setActiveCategory] = useState('all');

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
    if (isRestaurant) {
      fetchAnalytics();
    } else {
      fetchSaved();
    }
  }, []);

  // Refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      if (isRestaurant) {
        fetchAnalytics();
      } else if (!loading) {
        fetchSaved();
      }
    }, [isRestaurant])
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
      posts = posts.filter(post => {
        const cat = (post.category || '').toLowerCase().trim();
        const locName = (post.location_name || '').toLowerCase().trim();
        const combined = `${cat} ${locName}`;

        switch (activeCategory) {
          case 'restaurant':
            return combined.includes('restaurant') || combined.includes('hotel') || combined.includes('dhaba');
          case 'cafe':
            return combined.includes('cafe') || combined.includes('café') || combined.includes('coffee');
          case 'biryani':
            return combined.includes('biryani');
          case 'pureveg':
            return combined.includes('veg') && !combined.includes('non') && !combined.includes('nonveg') && !combined.includes('non-veg');
          case 'nonveg':
            return combined.includes('nonveg') || combined.includes('non-veg') || combined.includes('non veg') || combined.includes('chicken') || combined.includes('mutton') || combined.includes('fish');
          default:
            return true;
        }
      });
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
    const counts: Record<string, number> = { all: savedPosts.length };
    CATEGORY_TABS.forEach(tab => {
      if (tab.id === 'all') return;
      counts[tab.id] = savedPosts.filter(post => {
        const cat = (post.category || '').toLowerCase().trim();
        const locName = (post.location_name || '').toLowerCase().trim();
        const combined = `${cat} ${locName}`;
        switch (tab.id) {
          case 'restaurant':
            return combined.includes('restaurant') || combined.includes('hotel') || combined.includes('dhaba');
          case 'cafe':
            return combined.includes('cafe') || combined.includes('café') || combined.includes('coffee');
          case 'biryani':
            return combined.includes('biryani');
          case 'pureveg':
            return combined.includes('veg') && !combined.includes('non') && !combined.includes('nonveg') && !combined.includes('non-veg');
          case 'nonveg':
            return combined.includes('nonveg') || combined.includes('non-veg') || combined.includes('non veg') || combined.includes('chicken') || combined.includes('mutton') || combined.includes('fish');
          default:
            return false;
        }
      }).length;
    });
    return counts;
  }, [savedPosts]);

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {CATEGORY_TABS.map(tab => {
          const isActive = activeCategory === tab.id;
          const count = categoryCounts[tab.id] || 0;
          // Only show tabs that have posts (except ALL which always shows)
          if (tab.id !== 'all' && count === 0) return null;
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
                  <Text style={styles.tabTextActive}>{tab.label}</Text>
                  {count > 0 && <Text style={styles.tabCountActive}>{count}</Text>}
                </LinearGradient>
              ) : (
                <View style={styles.tabInner}>
                  <Text style={styles.tabText}>{tab.label}</Text>
                  {count > 0 && <Text style={styles.tabCount}>{count}</Text>}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E94A37" />
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
                {searchQuery ? 'No results found' : activeCategory !== 'all' ? 'No saved posts in this category' : 'No Saved Posts'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try a different search term'
                  : activeCategory !== 'all'
                    ? 'Save posts from this category to see them here'
                    : 'Save posts to see your favorite places here'}
              </Text>
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
  tabsContainer: {
    maxHeight: 50,
    marginTop: 8,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  tabActive: {},
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
