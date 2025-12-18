import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BlurView } from 'expo-blur';

export const options = {
  headerShown: false,
};

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
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

  useFocusEffect(
    React.useCallback(() => {
      if (token) {
        console.log(
          '🔄 HappeningPlaces screen focused - refreshing locations'
        );
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

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 10 },
      });

      const locations = Array.isArray(response.data)
        ? response.data
        : [];
      setTopLocations(locations);
    } catch (error) {
      console.error(
        '❌ Error fetching top locations:',
        error.response?.data || error.message
      );
      setTopLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const formatUploadCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleLocationPress = (location) => {
    const locationName =
      location.location || location.location_name;
    if (locationName) {
      router.push({
        pathname: '/location-details',
        params: { locationName: encodeURIComponent(locationName) },
      });
    }
  };

  const fixUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE_URL}${cleanUrl}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dd0e1" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Container - Gradient with Rounded Bottom Corners */}
          <View style={styles.headerContainer}>
            <LinearGradient
              colors={['#E94A37', '#F2CF68', '#1B7C82']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientHeader}
            >
              <Text style={styles.headerTitle}>Cofau</Text>
            </LinearGradient>
          </View>

          {/* Title Box */}
          <View style={styles.titleBox}>
            <Text style={styles.titleMain}>Happening place</Text>
            <Text style={styles.titleSub}>
              Most Visited Restaurants
            </Text>
          </View>

          {/* Empty State */}
          {topLocations.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="location-outline"
                size={64}
                color="#CCC"
              />
              <Text style={styles.emptyTitle}>
                No locations yet
              </Text>
              <Text style={styles.emptySubtext}>
                Start posting with location tags to see popular
                places here!
              </Text>
            </View>
          )}

          {/* Location Cards */}
          {topLocations.map((location, index) => {
            const images = location.images || [];
            const remainingCount = images.length > 7 ? images.length - 7 : 0;

            return (
              <TouchableOpacity
                key={
                  location.location ||
                  location.location_name ||
                  index
                }
                style={styles.card}
                onPress={() => handleLocationPress(location)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.rankNumber}>
                    <LinearGradient
                      colors={['#E94A37', '#F2CF68', '#1B7C82']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.rankGradient}
                    >
                      <Text style={styles.rankNumberText}>
                        {index + 1}
                      </Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.locationInfo}>
                    <Text
                      style={styles.locationName}
                      numberOfLines={1}
                    >
                      {location.location ||
                        location.location_name}
                    </Text>
                    <Text style={styles.uploadCount}>
                      (
                      {formatUploadCount(
                        location.uploads
                      )}{' '}
                      uploaded)
                    </Text>
                  </View>
                </View>

                <View style={styles.imageGrid}>
                  {images.length > 0 ? (
                    <>
                      {/* Show first 7 images */}
                      {images
                        .slice(0, 7)
                        .map((imageUrl, imgIndex) => {
                          const fixedUrl =
                            fixUrl(imageUrl);
                          if (!fixedUrl) return null;

                          return (
                            <Image
                              key={imgIndex}
                              source={{ uri: fixedUrl }}
                              style={styles.gridImage}
                              resizeMode="cover"
                            />
                          );
                        })}

                      {/* Show 8th image with blur overlay if more than 7 images */}
                      {remainingCount > 0 && images[7] && (
                        <View style={styles.blurredImageContainer}>
                          <Image
                            source={{ uri: fixUrl(images[7]) }}
                            style={styles.gridImage}
                            resizeMode="cover"
                            blurRadius={10}
                          />
                          <View style={styles.overlayCount}>
                            <Text style={styles.overlayCountText}>
                              +{remainingCount}
                            </Text>
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <View
                      style={styles.noImagePlaceholder}
                    >
                      <Ionicons
                        name="image-outline"
                        size={32}
                        color="#CCC"
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bottom Navigation - Same as Explore */}
        <View style={styles.navBar}>
          {/* Home */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/feed')}
          >
            <Ionicons
              name="home-outline"
              size={28}
              color="#000"
            />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>

          {/* Explore */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/explore')}
          >
            <Ionicons
              name="compass-outline"
              size={28}
              color="#000"
            />
            <Text style={styles.navLabel}>
              Explore
            </Text>
          </TouchableOpacity>

          {/* Center - Top Posts with Camera Icon */}
          <TouchableOpacity
            style={styles.centerNavItem}
            onPress={() => router.push('/leaderboard')}
          >
            <View style={styles.centerIconCircle}>
              <Ionicons
                name="camera"
                size={28}
                color="#000"
              />
            </View>
            <Text style={styles.navLabel}>
              Top Posts
            </Text>
          </TouchableOpacity>

          {/* Happening */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/happening')}
          >
            <Ionicons
              name="location"
              size={28}
              color="#000"
            />
            <Text style={styles.navLabelActive}>
              Happening
            </Text>
          </TouchableOpacity>

          {/* Profile */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/profile')}
          >
            <Ionicons
              name="person-outline"
              size={28}
              color="#000"
            />
            <Text style={styles.navLabel}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },

  /* Header Container */
  headerContainer: {
    marginBottom: -25,
  },

  /* Gradient Header - With Rounded Bottom Corners */
  gradientHeader: {
    paddingTop: 50,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },

  headerTitle: {
    fontFamily: 'Lobster',
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 1,
  },

  scrollView: { 
    flex: 1 
  },
  scrollContent: {
    paddingBottom: 100,
  },
  titleBox: {
    backgroundColor: '#FFF',
    borderRadius: 35,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleMain: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    fontStyle: 'lobster',
    textDecorationLine: 'underline',
  },
  titleSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    paddingVertical: 4, 
  },
  rankNumber: {
    width: 25,
    height: 25,
    borderRadius: 16,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rankGradient: {
    width: 35,
    height: 35,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  locationInfo: { 
    flex: 1,
    justifyContent: 'center', 
    marginTop: 0,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  uploadCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  blurredImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  overlayCount: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  overlayCountText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 20,
  },
  noImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  /* Bottom Navigation - Same as Explore */
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  navLabel: {
    fontSize: 11,
    color: '#000',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },

  navLabelActive: {
    fontSize: 11,
    color: '#000',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '700',
  },

  // Center elevated item
  centerNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -30,
  },

  // Circle background for center icon
  centerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});