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

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

export default function ExploreScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [topRatedPosts, setTopRatedPosts] = useState([]);
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

      // Fetch all explore data in parallel
      const [trending, topRated, reviewers] = await Promise.all([
        axios.get(`${API_URL}/explore/trending?limit=10`),
        axios.get(`${API_URL}/explore/top-rated?limit=6`),
        axios.get(`${API_URL}/explore/reviewers?limit=10`),
      ]);

      console.log('📊 Explore data fetched:');
      console.log('  - Trending:', trending.data.length, 'posts');
      console.log('  - Top Rated:', topRated.data.length, 'posts');
      console.log('  - Top Reviewers:', reviewers.data.length, 'users');

      // Transform data to add full image URLs
      const transformedTrending = trending.data.map(post => ({
        ...post,
        full_image_url: post.image_url ? `${API_BASE_URL}${post.image_url}` : null,
      }));

      const transformedTopRated = topRated.data.map(post => ({
        ...post,
        full_image_url: post.image_url ? `${API_BASE_URL}${post.image_url}` : null,
      }));

      setTrendingPosts(transformedTrending);
      setTopRatedPosts(transformedTopRated);
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

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Trending Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 Trending Now</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScroll}
          >
            {trendingPosts.length > 0 ? trendingPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.trendingCard}
                onPress={() => router.push(`/post-details`)}
              >
                {post.full_image_url ? (
                  <Image
                    source={{ uri: post.full_image_url }}
                    style={styles.trendingImage}
                    resizeMode="cover"
                    onError={(e) => console.log('❌ Failed to load trending image:', post.full_image_url)}
                  />
                ) : (
                  <LinearGradient
                    colors={['#66D9E8', '#F093FB', '#F5576C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.trendingImage}
                  >
                    <View style={styles.placeholderContent}>
                      <Text style={styles.placeholderText}>No Image</Text>
                    </View>
                  </LinearGradient>
                )}
                <View style={styles.trendingOverlay}>
                  <View style={styles.trendingInfo}>
                    <Text style={styles.trendingUsername}>{post.username}</Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.ratingText}>{post.rating}/10</Text>
                    </View>
                  </View>
                  <View style={styles.engagementRow}>
                    <View style={styles.engagementItem}>
                      <Ionicons name="heart" size={16} color="#FF6B6B" />
                      <Text style={styles.engagementText}>{post.likes_count}</Text>
                    </View>
                    <View style={styles.engagementItem}>
                      <Ionicons name="chatbubble" size={16} color="#4dd0e1" />
                      <Text style={styles.engagementText}>{post.comments_count}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.categoryChipActive,
                ]}
                onPress={() => handleCategoryPress(category)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Top Rated Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⭐ Top Rated</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.gridContainer}>
            {topRatedPosts.length > 0 ? topRatedPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.gridCard}
                onPress={() => router.push(`/post-details`)}
              >
                {post.full_image_url ? (
                  <Image
                    source={{ uri: post.full_image_url }}
                    style={styles.gridImage}
                    resizeMode="cover"
                    onError={(e) => console.log('❌ Failed to load grid image:', post.full_image_url)}
                  />
                ) : (
                  <LinearGradient
                    colors={['#66D9E8', '#F093FB', '#F5576C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gridImage}
                  >
                    <View style={styles.placeholderContent}>
                      <Text style={styles.placeholderText}>No Image</Text>
                    </View>
                  </LinearGradient>
                )}
                <View style={styles.gridOverlay}>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.gridRating}>{post.rating}</Text>
                  </View>
                  <View style={styles.likeBadge}>
                    <Ionicons name="heart" size={12} color="#FFF" />
                    <Text style={styles.gridLikes}>{post.likes_count}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Top Reviewers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>👑 Top Reviewers</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.reviewersScroll}
          >
            {topReviewers.map((reviewer) => (
              <TouchableOpacity
                key={reviewer.id}
                style={styles.reviewerCard}
                onPress={() => router.push(`/profile/${reviewer.id}`)}
              >
                <View style={styles.reviewerAvatar}>
                  <Text style={styles.reviewerAvatarText}>
                    {reviewer.username.charAt(0).toUpperCase()}
                  </Text>
                  {reviewer.badge && (
                    <View style={styles.reviewerBadge}>
                      <Text style={styles.badgeEmoji}>🏆</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.reviewerName} numberOfLines={1}>
                  {reviewer.username}
                </Text>
                <Text style={styles.reviewerLevel}>Level {reviewer.level}</Text>
                <Text style={styles.reviewerStats}>{reviewer.posts_count} posts</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/feed')}
        >
          <Ionicons name="home-outline" size={26} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="search-outline" size={26} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/add-post')}
        >
          <Ionicons name="add-circle" size={32} color="#4dd0e1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/explore')}
        >
          <Ionicons name="compass" size={26} color="#4dd0e1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person-outline" size={26} color="#999" />
        </TouchableOpacity>
      </View>
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
  horizontalScroll: {
    paddingLeft: 16,
  },
  trendingCard: {
    width: CARD_WIDTH,
    height: 200,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  trendingImage: {
    width: '100%',
    height: '100%',
  },
  trendingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  trendingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendingUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 16,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  categoriesScroll: {
    paddingLeft: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#4dd0e1',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  gridCard: {
    width: (width - 48) / 2,
    height: 160,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'column',
    gap: 4,
  },
  gridRating: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
  likeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  gridLikes: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  reviewersScroll: {
    paddingLeft: 16,
  },
  reviewerCard: {
    width: 100,
    alignItems: 'center',
    marginRight: 16,
  },
  reviewerAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4dd0e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  reviewerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeEmoji: {
    fontSize: 14,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    width: '100%',
  },
  reviewerLevel: {
    fontSize: 12,
    color: '#4dd0e1',
    fontWeight: '600',
    marginTop: 2,
  },
  reviewerStats: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  bottomSpacer: {
    height: 80,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  navButton: {
    padding: 8,
  },
});
