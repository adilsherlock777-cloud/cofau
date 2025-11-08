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

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://food-app-debug.preview.emergentagent.com';
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
      const transformedPosts = response.data.map(post => ({
        id: post.id,
        user_id: post.user_id,
        username: post.username,
        user_profile_picture: post.user_profile_picture,
        user_badge: post.user_badge,
        description: post.review_text,
        rating: post.rating / 10, // Backend uses 1-10, display as 0-1 scale
        ratingLabel: getRatingLabel(post.rating),
        location: extractLocationFromMapLink(post.map_link),
        mapsUrl: post.map_link,
        likes: post.likes_count,
        comments: post.comments_count,
        shares: 0, // Not implemented yet
        media_url: post.media_url,
        media_type: post.media_type,
        created_at: post.created_at,
        popularPhotos: [], // Can be populated later
      }));
      
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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Header Section */}
        <View style={styles.userSection}>
          <View style={styles.userHeader}>
            <View style={styles.avatarLarge}>
              <Ionicons name="person" size={32} color="#FFF" />
            </View>
            <View style={styles.userInfo}>
              <View style={styles.levelRow}>
                <Text style={styles.levelText}>Level 3</Text>
              </View>
              <RatingBar current={85} total={100} label="" />
            </View>
          </View>
        </View>

        {/* Reviewer Circles */}
        <View style={styles.reviewerSection}>
          <ReviewerCircles reviewers={reviewers} />
        </View>

        {/* Feed Cards */}
        {feedPosts.map((post) => (
          <FeedCard key={post.id} post={post} />
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/feed')}
        >
          <Ionicons name="home" size={26} color="#333" />
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
          <Ionicons name="add-circle-outline" size={32} color="#999" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/happening')}
        >
          <Ionicons name="flame-outline" size={26} color="#999" />
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
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    justifyContent: 'space-around',
  },
  navButton: {
    padding: 8,
  },
});