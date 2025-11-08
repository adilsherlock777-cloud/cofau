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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://food-app-debug.preview.emergentagent.com';
const API_URL = `${API_BASE_URL}/api`;

// Screen dimensions and card sizing for 3-column grid
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 6;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * 4) / 3;

export default function ExploreScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allPosts, setAllPosts] = useState([]);
  const [topReviewers, setTopReviewers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Burger', 'Pizza', 'Sushi', 'Dessert', 'Coffee', 'Pasta', 'Chinese'];

  useFocusEffect(
    React.useCallback(() => {
      fetchExploreData();
    }, [])
  );

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching explore data...');
      console.log('   Authorization header:', axios.defaults.headers.common['Authorization'] ? 'Present' : 'Missing');

      // Fetch explore all (engagement-based) and reviewers
      const [exploreAll, reviewers] = await Promise.all([
        axios.get(`${API_URL}/explore/all?limit=30`),
        axios.get(`${API_URL}/explore/reviewers?limit=10`),
      ]);

      console.log('📊 Explore data fetched:');
      console.log('  - All Posts:', exploreAll.data.length, 'posts');
      console.log('  - Top Reviewers:', reviewers.data.length, 'users');

      // Log first post to see structure
      if (exploreAll.data.length > 0) {
        console.log('  - Sample post:', JSON.stringify(exploreAll.data[0], null, 2));
      }

      // Transform data to add full image URLs
      const transformedPosts = exploreAll.data.map(post => {
        // Get the image URL from backend
        const imageUrl = post.image_url || post.media_url;
        
        // Convert relative path to full URL
        let fullUrl = null;
        if (imageUrl) {
          // If it's already a full URL, use it as is
          if (imageUrl.startsWith('http')) {
            fullUrl = imageUrl;
          } else {
            // If it's a relative path, prepend base URL
            fullUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
          }
        }
        
        console.log(`📸 Post ${post.id}:`);
        console.log(`   - Raw image_url: ${imageUrl}`);
        console.log(`   - Full URL: ${fullUrl}`);
        
        return {
          ...post,
          full_image_url: fullUrl,
        };
      });

      setAllPosts(transformedPosts);
      setTopReviewers(reviewers.data);
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

  const handleCategoryPress = async (category) => {
    setSelectedCategory(category);
    if (category === 'All') {
      fetchExploreData();
    } else {
      try {
        const response = await axios.get(`${API_URL}/explore/category?name=${category}&limit=6`);
        const transformedPosts = response.data.map(post => ({
          ...post,
          full_image_url: post.image_url ? `${API_BASE_URL}${post.image_url}` : null,
        }));
        setTopRatedPosts(transformedPosts);
      } catch (error) {
        console.error('❌ Error fetching category:', error);
      }
    }
  };

  const getRatingLabel = (rating) => {
    if (rating >= 9) return 'Excellent';
    if (rating >= 7) return 'Very Good';
    if (rating >= 5) return 'Good';
    return 'Average';
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4dd0e1" />
        <Text style={styles.loadingText}>Exploring...</Text>
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
            <View style={styles.gridContainer}>
              {allPosts.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.gridItem}
                  onPress={() => router.push('/feed')}
                >
                  {post.full_image_url ? (
                    <Image
                      source={{ uri: post.full_image_url }}
                      style={styles.gridItemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.gridItemPlaceholder}>
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
    backgroundColor: '#FFF',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4dd0e1',
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    justifyContent: 'flex-start',
  },
  gridItem: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    margin: CARD_MARGIN,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  gridItemImage: {
    width: '100%',
    height: '100%',
  },
  gridItemPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  gridItemOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  gridItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 2,
  },
  gridItemRating: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  bottomSpacer: {
    height: 100,
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
});
