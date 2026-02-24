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
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { normalizeMediaUrl, BACKEND_URL } from '../../utils/imageUrlFix';

const API_URL = `${BACKEND_URL}/api`;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - 6) / 3;

export default function LikedPostsScreen() {
  const router = useRouter();
  const auth = useAuth() as any;
  const { token } = auth;

  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLiked();
  }, []);

  const fetchLiked = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/liked/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLikedPosts(response.data || []);
    } catch (error) {
      console.error('Error fetching liked posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLiked();
    setRefreshing(false);
  };

  // Group posts by location, sorted latest to oldest
  const groupedByLocation = useMemo(() => {
    const groups: Record<string, any[]> = {};

    // Posts are already sorted latest-first from API (by liked_at / created_at desc)
    for (const post of likedPosts) {
      const location = post.location_name?.trim() || 'Other';
      if (!groups[location]) {
        groups[location] = [];
      }
      groups[location].push(post);
    }

    // Sort groups: the group whose first (most recent) post was liked most recently comes first
    const sortedEntries = Object.entries(groups).sort(([, postsA], [, postsB]) => {
      const dateA = new Date(postsA[0]?.liked_at || postsA[0]?.created_at || 0).getTime();
      const dateB = new Date(postsB[0]?.liked_at || postsB[0]?.created_at || 0).getTime();
      return dateB - dateA;
    });

    return sortedEntries;
  }, [likedPosts]);

  const renderPost = (post: any) => {
    const mediaUrl = normalizeMediaUrl(post.media_url);
    const thumbnailUrl = post.thumbnail_url ? normalizeMediaUrl(post.thumbnail_url) : null;
    const isVideo =
      post.media_type === 'video' ||
      mediaUrl?.toLowerCase().endsWith('.mp4') ||
      mediaUrl?.toLowerCase().endsWith('.mov');

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
          </View>
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
          <Text style={styles.headerTitle}>Liked Posts</Text>
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
        <Text style={styles.headerTitle}>Liked Posts</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {likedPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Liked Posts</Text>
            <Text style={styles.emptySubtitle}>
              Posts you like will appear here
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
});
