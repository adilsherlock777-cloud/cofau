import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'https://foodsocial-app.preview.emergentagent.com/api';

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
    // TODO: Navigate to location details
    // router.push(`/location-details/${location.location}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4dd0e1" />
      </View>
    );
  }

  if (topLocations.length === 0) {
    return null; // Don't show section if no locations
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
          key={location.location}
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
                {location.location}
              </Text>
              <Text style={styles.uploadCount}>
                {formatUploadCount(location.uploads)} uploaded
              </Text>
            </View>

            {/* Image Thumbnails */}
            <View style={styles.imageRow}>
              {location.images.slice(0, 3).map((imageUrl, imgIndex) => (
                <LinearGradient
                  key={imgIndex}
                  colors={['#ffeaa7', '#fd79a8', '#a29bfe']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.imageThumbnail}
                >
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                </LinearGradient>
              ))}
              
              {/* Placeholder gradients if less than 3 images */}
              {[...Array(Math.max(0, 3 - location.images.length))].map((_, idx) => (
                <LinearGradient
                  key={`placeholder-${idx}`}
                  colors={['#ffeaa7', '#fd79a8', '#a29bfe']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.imageThumbnail}
                />
              ))}
            </View>

            {/* "+NN+" Badge */}
            {location.uploads > 3 && (
              <LinearGradient
                colors={['#f3a683', '#3dc1d3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badge}
              >
                <Text style={styles.badgeText}>
                  +{location.uploads - 3}+
                </Text>
              </LinearGradient>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
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
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
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
});
