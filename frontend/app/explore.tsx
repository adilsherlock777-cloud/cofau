import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://meal-snap-4.preview.emergentagent.com';
const API_URL = `${API_BASE_URL}/api`;

// Screen dimensions and card sizing for 3-column grid
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 6;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * 4) / 3;

console.log('✅ NEW Explore.tsx loaded - This is the CLEAN version with NO gradients!');

export default function ExploreScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allPosts, setAllPosts] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      if (user && token) {
        fetchExploreData();
      }
    }, [user, token])
  );

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Explore fetching with token:', token ? 'Present' : 'Missing');

      const response = await axios.get(`${API_URL}/explore/all?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('📊 Explore data received:', response.data.length, 'posts');

      // Transform data to add full image URLs
      const transformedPosts = response.data.map(post => {
        const imageUrl = post.image_url || post.media_url;
        let fullUrl = null;
        
        if (imageUrl) {
          if (imageUrl.startsWith('http')) {
            fullUrl = imageUrl;
          } else {
            fullUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
          }
        }
        
        console.log(`📸 Post ${post.id}: ${fullUrl}`);
        
        return {
          ...post,
          full_image_url: fullUrl,
        };
      });

      setAllPosts(transformedPosts);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('❌ Error fetching explore data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchExploreData();
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <TouchableOpacity onPress={() => router.push('/search')}>
          <Ionicons name="search" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4dd0e1" />
          <Text style={styles.loadingText}>Loading explore...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Main Explore Grid - 3 columns */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔥 Discover Food</Text>
            
            {allPosts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="restaurant-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {allPosts.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.gridItem}
                    onPress={() => router.push('/feed')}
                  >
                    {post.full_image_url ? (
                      <Image
                        source={{ 
                          uri: post.full_image_url,
                          cache: 'reload'
                        }}
                        style={styles.gridItemImage}
                        resizeMode="cover"
                        onError={(error) => {
                          console.error('❌ Explore image failed to load:', post.full_image_url, error.nativeEvent);
                        }}
                      />
                    ) : (
                      <View style={styles.noImageContainer}>
                        <Ionicons name="image-outline" size={32} color="#CCC" />
                      </View>
                    )}
                    <View style={styles.gridItemOverlay}>
                      <View style={styles.gridItemBadge}>
                        <Ionicons name="star" size={10} color="#FFD700" />
                        <Text style={styles.gridItemRating}>{post.rating}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: CARD_MARGIN,
  },

  gridItem: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    margin: CARD_MARGIN,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f2f2f2', // fallback
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'gold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
