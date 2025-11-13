import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { likePost, unlikePost } from '../utils/api';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://cofau-app.preview.emergentagent.com';
const API_URL = `${API_BASE_URL}/api`;

// Screen dimensions and card sizing for 3-column grid
const SCREEN_WIDTH = Dimensions.get('window').width;
const SPACING = 2; // Minimal spacing between grid items
const NUM_COLUMNS = 3;
const TILE_SIZE = (SCREEN_WIDTH - (SPACING * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

console.log('✅ Explore Screen - Redesigned with 3-column grid layout');

export default function ExploreScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (user && token) {
        fetchPosts(true);
      }
    }, [user, token])
  );

  const fetchPosts = async (refresh = false) => {
    if (!hasMore && !refresh) return;
    if (loadingMore) return;

    try {
      if (refresh) {
        setLoading(true);
        setPage(1);
        setPosts([]);
      } else {
        setLoadingMore(true);
      }

      const currentPage = refresh ? 1 : page;
      console.log('🔍 Fetching explore posts, page:', currentPage);

      const response = await axios.get(`${API_URL}/feed?limit=30&skip=${(currentPage - 1) * 30}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('📊 Received', response.data.length, 'posts');

      // Transform data to add full image URLs and validate required fields
      const transformedPosts = response.data
        .filter(post => {
          // Filter out posts without required fields
          if (!post.id || !post.user_id) {
            console.warn('⚠️ Skipping post without id or user_id:', post);
            return false;
          }
          if (!post.image_url && !post.media_url) {
            console.warn('⚠️ Skipping post without image:', post.id);
            return false;
          }
          return true;
        })
        .map(post => {
          const imageUrl = post.image_url || post.media_url;
          let fullUrl = null;
          
          if (imageUrl) {
            if (imageUrl.startsWith('http')) {
              fullUrl = imageUrl;
            } else {
              fullUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
            }
          }
          
          return {
            ...post,
            full_image_url: fullUrl,
            is_liked: post.is_liked_by_user || post.is_liked || false,
          };
        });

      if (refresh) {
        setPosts(transformedPosts);
      } else {
        setPosts(prev => [...prev, ...transformedPosts]);
      }

      setHasMore(transformedPosts.length >= 30);
      setPage(currentPage + 1);
      setLoading(false);
      setLoadingMore(false);
    } catch (error) {
      console.error('❌ Error fetching explore data:', error);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLikeToggle = async (postId, isCurrentlyLiked) => {
    try {
      // Optimistic update
      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { ...post, is_liked: !isCurrentlyLiked, likes_count: post.likes_count + (isCurrentlyLiked ? -1 : 1) }
            : post
        )
      );

      // API call
      if (isCurrentlyLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
    } catch (error) {
      console.error('❌ Error toggling like:', error);
      // Revert on error
      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? { ...post, is_liked: isCurrentlyLiked, likes_count: post.likes_count + (isCurrentlyLiked ? 1 : -1) }
            : post
        )
      );
    }
  };

  const renderGridItem = ({ item }) => {
    const isVideo = item.media_type === 'video';
    
    return (
      <TouchableOpacity
        style={styles.gridTile}
        onPress={() => router.push(`/post-details/${item.id}`)}
        activeOpacity={0.8}
      >
        {item.full_image_url ? (
          <Image
            source={{ uri: item.full_image_url }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.noImageContainer}>
            <Ionicons name="image-outline" size={40} color="#CCC" />
          </View>
        )}

        {/* Play icon for videos - bottom left */}
        {isVideo && (
          <View style={styles.playIconContainer}>
            <Ionicons name="play" size={16} color="#fff" />
          </View>
        )}

        {/* Heart icon for like - top right */}
        <TouchableOpacity
          style={styles.heartIconContainer}
          onPress={(e) => {
            e.stopPropagation();
            handleLikeToggle(item.id, item.is_liked);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={item.is_liked ? 'heart' : 'heart-outline'}
            size={20}
            color={item.is_liked ? '#FF6B6B' : '#fff'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="SEARCH"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#666" />
      </View>
    );
  };

  // Show loading if not authenticated yet
  if (!user || !token) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text style={styles.loadingText}>Authenticating...</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text style={styles.loadingText}>Loading explore...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderGridItem}
        keyExtractor={(item, index) => `${item.id}_${index}`}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onEndReached={() => fetchPosts(false)}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.columnWrapper}
      />

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push('/feed')}>
          <Ionicons name="home-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/explore')}>
          <Ionicons name="compass" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/add-post')}>
          <Ionicons name="add-circle-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/happening')}>
          <Ionicons name="flame-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={28} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },

  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    letterSpacing: 0.5,
  },

  searchIcon: {
    marginLeft: 8,
  },

  gridContainer: {
    paddingBottom: 100,
  },

  columnWrapper: {
    gap: SPACING,
    paddingHorizontal: SPACING,
  },

  gridTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    marginBottom: SPACING,
    position: 'relative',
    backgroundColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  gridImage: {
    width: '100%',
    height: '100%',
  },

  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },

  playIconContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  heartIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
