import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'https://backend.cofau.com/api';

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

  const fetchTopLocations = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching top locations from:', `${API_URL}/locations/top`);
      
      const response = await axios.get(`${API_URL}/locations/top`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 5 },
      });
      
      console.log('📊 TOP LOCATIONS RESPONSE:', response.data);
      console.log('📊 Number of locations:', response.data.length);
      
      setTopLocations(response.data);
    } catch (error) {
      console.error('❌ Error fetching top locations:', error.response?.data || error.message);
      console.error('❌ Full error:', error);
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
                {formatUploadCount(location.uploads)} uploaded
              </Text>
            </View>

            {/* Image Thumbnails - Max 5 images */}
            <View style={styles.imageRow}>
              {location.images.slice(0, 5).map((imageUrl, imgIndex) => {
                // Fix URL if needed
                const fixedUrl = imageUrl?.startsWith('http') 
                  ? imageUrl 
                  : `https://backend.cofau.com${imageUrl?.startsWith('/') ? imageUrl : '/' + imageUrl}`;
                
                return (
                  <View key={imgIndex} style={styles.imageThumbnail}>
                    <Image
                      source={{ uri: fixedUrl }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 0,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 10,
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
    padding: 12,
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  locationInfo: {
    flex: 1,
    marginRight: 12,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  uploadCount: {
    fontSize: 12,
    color: '#666',
  },
  imageRow: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  imageThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 4,
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
});
