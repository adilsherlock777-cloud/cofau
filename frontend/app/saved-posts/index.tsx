import React, { useState, useEffect, useMemo } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getSavedPosts } from '../../utils/api';
import { normalizeMediaUrl } from '../../utils/imageUrlFix';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - 6) / 3; // 3 columns with 2px gaps

type FilterTab = 'all' | 'users' | 'restaurants';

export default function SavedPostsScreen() {
  const router = useRouter();
  const auth = useAuth() as any;
  const { token } = auth;

  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

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

  // Filter posts by tab
  const filteredPosts = useMemo(() => {
    if (activeFilter === 'all') return savedPosts;
    if (activeFilter === 'restaurants') return savedPosts.filter(p => p.account_type === 'restaurant');
    return savedPosts.filter(p => p.account_type !== 'restaurant');
  }, [savedPosts, activeFilter]);

  // Counts for tab badges
  const userCount = useMemo(() => savedPosts.filter(p => p.account_type !== 'restaurant').length, [savedPosts]);
  const restaurantCount = useMemo(() => savedPosts.filter(p => p.account_type === 'restaurant').length, [savedPosts]);

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

  const renderFilterTab = (tab: FilterTab, label: string, count: number) => {
    const isActive = activeFilter === tab;
    return (
      <TouchableOpacity
        key={tab}
        style={styles.filterTab}
        onPress={() => setActiveFilter(tab)}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
          {label}{count > 0 ? ` (${count})` : ''}
        </Text>
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

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {renderFilterTab('all', 'All', savedPosts.length)}
        {renderFilterTab('users', 'Users', userCount)}
        {renderFilterTab('restaurants', 'Restaurants', restaurantCount)}
      </View>

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
    </View>
  );
}

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
