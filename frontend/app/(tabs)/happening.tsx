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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getSavedPosts } from '../../utils/api';
import { normalizeMediaUrl } from '../../utils/imageUrlFix';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://api.cofau.com";
const API_URL = `${API_BASE_URL}/api`;

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - 6) / 3; // 3 columns with 2px gaps

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

  // Group posts by location, sorted latest to oldest
  const groupedByLocation = useMemo(() => {
    const groups: Record<string, any[]> = {};

    for (const post of savedPosts) {
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
  }, [savedPosts]);

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
          </View>
        )}
      </TouchableOpacity>
    );
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
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaskedView
            maskElement={
              <Text style={styles.headerTitleLobster}>Saved Locations</Text>
            }
          >
            <LinearGradient
              colors={['#FF2E2E', '#FF7A18']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.headerTitleLobster, { opacity: 0 }]}>Saved Locations</Text>
            </LinearGradient>
          </MaskedView>
          <View style={styles.subtitleRow}>
            <Ionicons name="location" size={16} color="#E94A37" />
            <Text style={styles.titleSub}>Places you've saved</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E94A37" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaskedView
          maskElement={
            <Text style={styles.headerTitleLobster}>Saved Locations</Text>
          }
        >
          <LinearGradient
            colors={['#FF2E2E', '#FF7A18']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.headerTitleLobster, { opacity: 0 }]}>Saved Locations</Text>
          </LinearGradient>
        </MaskedView>
        <View style={styles.subtitleRow}>
          <Ionicons name="location" size={16} color="#E94A37" />
          <Text style={styles.titleSub}>Places you've saved</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {savedPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Saved Locations</Text>
            <Text style={styles.emptySubtitle}>
              Save posts to see your favorite places here
            </Text>
          </View>
        ) : (
          <View style={styles.locationList}>
            {groupedByLocation.map(([location, posts]) => (
              <View key={location} style={styles.locationSection}>
                <View style={styles.locationHeader}>
                  <Ionicons name="location-sharp" size={18} color="#E94A37" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 90,
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
