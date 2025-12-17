import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

export default function HappeningPlaces() {
  const router = useRouter();
  const { token } = useAuth();
  const [topLocations, setTopLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchTopLocations();
    }
  }, [token]);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (token) {
        console.log('🔄 HappeningPlaces screen focused - refreshing locations');
        fetchTopLocations();
      }
    }, [token])
  );

  const fetchTopLocations = async () => {
    if (!token) {
      console.warn('⚠️ No token available for fetching locations');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const endpoint = `${API_URL}/locations/top`;
      console.log('🔍 Fetching top locations from:', endpoint);
      console.log('🔑 Using token:', token ? 'Present' : 'Missing');

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 5 },
      });

      console.log('📊 TOP LOCATIONS RESPONSE:', response.data);
      console.log('📊 Response type:', typeof response.data);
      console.log('📊 Number of locations:', Array.isArray(response.data) ? response.data.length : 'Not an array');

      // Ensure we have an array
      const locations = Array.isArray(response.data) ? response.data : [];
      setTopLocations(locations);

      if (locations.length === 0) {
        console.log('⚠️ No locations returned from API');
      }
    } catch (error) {
      console.error('❌ Error fetching top locations:', error.response?.data || error.message);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error headers:', error.response?.headers);
      console.error('❌ Full error:', error);
      setTopLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const formatUploadCount = (count) => {
    if (count >= 1000) {
      return `${Math.floor(count / 1000)}K`;
    }
    return count.toString();
  };

  const handleLocationPress = (location) => {
    console.log('📍 Location pressed:', location);
    const locationName = location.location || location.location_name;
    if (locationName) {
      router.push({
        pathname: '/location-details',
        params: { locationName: encodeURIComponent(locationName) }
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    );
  }

  if (!loading && topLocations.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Happening Places Near You</Text>
          <Text style={styles.headerSubtitle}>Top rated restaurants this week</Text>
        </LinearGradient>

        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No locations yet</Text>
          <Text style={styles.emptySubtitle}>
            Start posting with location tags to see popular places here!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient Background */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Happening Places Near You</Text>
          <Text style={styles.headerSubtitle}>Top rated restaurants this week</Text>
        </LinearGradient>

        {/* Location Cards */}
        {topLocations.map((location, index) => (
          <TouchableOpacity
            key={location.location || location.location_name || index}
            style={styles.card}
            onPress={() => handleLocationPress(location)}
            activeOpacity={0.8}
          >
            <View style={styles.cardContent}>
              {/* Rank Number */}
              <View style={styles.rankContainer}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>

              {/* Location Info */}
              <View style={styles.locationInfo}>
                <Text style={styles.locationName} numberOfLines={1}>
                  {location.location || location.location_name}
                </Text>
                <Text style={styles.uploadCount}>
                  {formatUploadCount(location.uploads)} {location.uploads === 1 ? 'post' : 'posts'}
                </Text>
              </View>

              {/* Image Thumbnails - Max 5 images */}
              <View style={styles.imageRow}>
                {location.images && location.images.length > 0 ? (
                  location.images.slice(0, 5).map((imageUrl, imgIndex) => {
                    // Fix URL if needed
                    const fixUrl = (url) => {
                      if (!url) return null;
                      if (url.startsWith('http')) return url;
                      // Handle relative URLs
                      const cleanUrl = url.startsWith('/') ? url : `/${url}`;
                      return `${API_BASE_URL}${cleanUrl}`;
                    };

                    const fixedUrl = fixUrl(imageUrl);
                    if (!fixedUrl) return null;

                    return (
                      <View key={imgIndex} style={styles.imageThumbnail}>
                        <Image
                          source={{ uri: fixedUrl }}
                          style={styles.thumbnailImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.error(`❌ Image load error for ${fixedUrl}:`, error);
                          }}
                        />
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.imageThumbnail}>
                    <Ionicons name="image-outline" size={24} color="#CCC" />
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bottom Navigation Footer */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/feed")}
        >
          <Ionicons name="home" size={24} color="#000" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/explore")}
        >
          <Ionicons name="compass-outline" size={24} color="#000" />
          <Text style={styles.navLabel}>Explore</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/leaderboard")}
        >
          <Ionicons name="trophy-outline" size={24} color="#000" />
          <Text style={styles.navLabel}>Leaderboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/happening")}
        >
          <Ionicons name="restaurant" size={24} color="#667eea" />
          <Text style={[styles.navLabel, styles.activeNavLabel]}>Restaurant</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/profile")}
        >
          <Ionicons name="person-outline" size={24} color="#000" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rankContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  locationInfo: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  uploadCount: {
    fontSize: 13,
    color: '#666',
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 0,
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  activeNavLabel: {
    color: '#667eea',
    fontWeight: '600',
  },
});
