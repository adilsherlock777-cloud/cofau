import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import RatingBar from '../components/RatingBar';
import ReviewerCircles from '../components/ReviewerCircles';
import FeedCard from '../components/FeedCard';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://meal-snap-4.preview.emergentagent.com';
const API_URL = `${API_BASE_URL}/api`;

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [feedPosts, setFeedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Dummy data for reviewers - can be fetched from backend later
  const reviewers = [
    { letter: 'H', count: 5 },
    { letter: 'B', count: 2 },
    { letter: 'T', count: 7 },
    { letter: 'M', count: 3 },
    { letter: 'G', count: 1 },
    { letter: 'S', count: 4 },
  ];

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      setError(null);
      console.log('📡 Fetching feed from:', `${API_URL}/feed`);
      
      const response = await axios.get(`${API_URL}/feed`);
      console.log('✅ Feed data received:', response.data.length, 'posts');
      
      // Transform the data to match the component expectations
      const transformedPosts = response.data.map(post => {
        // Use image_url if provided, otherwise fall back to media_url
        let mediaUrl = post.image_url || post.media_url;
        console.log('📸 Original image_url/media_url:', mediaUrl);
        
        // Convert to full URL if it's a relative path
        if (mediaUrl && !mediaUrl.startsWith('http')) {
          // Remove leading slash if present and construct full URL
          mediaUrl = `${API_BASE_URL}${mediaUrl.startsWith('/') ? mediaUrl : '/' + mediaUrl}`;
          console.log('📸 Converted to full URL:', mediaUrl);
        }
        
        return {
          id: post.id,
          user_id: post.user_id,
          username: post.username,
          user_profile_picture: post.user_profile_picture,
          user_badge: post.user_badge,
          description: post.review_text,
          rating: post.rating, // Backend returns 1-10, display as-is
          ratingLabel: getRatingLabel(post.rating),
          location: extractLocationFromMapLink(post.map_link),
          mapsUrl: post.map_link,
          likes: post.likes_count,
          comments: post.comments_count,
          shares: 0, // Not implemented yet
          is_liked: post.is_liked_by_user || false,
          media_url: mediaUrl,
          media_type: post.media_type,
          created_at: post.created_at,
          popularPhotos: [], // Can be populated later
        };
      });
      
      setFeedPosts(transformedPosts);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('❌ Error fetching feed:', error);
      setError('Failed to load feed');
      setLoading(false);
      setRefreshing(false);
      
      // Show alert on web
      if (Platform.OS === 'web') {
        // Don't block the UI with alerts in case of errors
        console.error('Feed fetch error:', error.message);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const getRatingLabel = (rating) => {
    if (rating >= 9) return 'Excellent Food';
    if (rating >= 7) return 'Very Good Food';
    if (rating >= 5) return 'Good Food';
    if (rating >= 3) return 'Average Food';
    return 'Below Average';
  };

  const extractLocationFromMapLink = (mapLink) => {
    if (!mapLink) return 'No location';
    
    // Try to extract location from Google Maps URL
    try {
      const url = new URL(mapLink);
      const query = url.searchParams.get('q');
      if (query) return query;
      
      // Fallback to basic parsing
      const match = mapLink.match(/q=([^&]+)/);
      return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'Location';
    } catch {
      return 'Location';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cofau</Text>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* User Header Section */}
        {user && (
          <View style={styles.userSection}>
            <View style={styles.userHeader}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLetter}>
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userNameText}>{user.full_name}</Text>
                <View style={styles.levelRow}>
                  <Text style={styles.levelText}>Level {user.level || 1}</Text>
                </View>
                <RatingBar current={user.points || 0} total={(user.level || 1) * 100} label="" />
              </View>
            </View>
          </View>
        )}

        {/* Reviewer Circles */}
        <View style={styles.reviewerSection}>
          <ReviewerCircles reviewers={reviewers} />
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4dd0e1" />
            <Text style={styles.loadingText}>Loading feed...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchFeed}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && feedPosts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share a food experience!</Text>
          </View>
        )}

        {/* Feed Cards */}
        {!loading && !error && feedPosts.map((post) => (
          <FeedCard key={post.id} post={post} onLikeUpdate={fetchFeed} />
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push('/feed')}>
          <Ionicons name="home-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/explore')}>
          <Ionicons name="compass-outline" size={28} color="#000" />
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
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#3B5998',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  userSection: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#66D9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewerSection: {
    backgroundColor: '#FFFEF0',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomSpacer: {
    height: 20,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4dd0e1',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});