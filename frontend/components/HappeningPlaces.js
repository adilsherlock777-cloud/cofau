import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image'; 
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BlurView } from 'expo-blur';
import LevelBadge from './LevelBadge';

export const options = {
  headerShown: false,
};

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.cofau.com';
const API_URL = `${API_BASE_URL}/api`;

const BLUR_HASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

// Check if URL is a video file
const isVideoFile = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('.mp4') ||
    lower.includes('.mov') ||
    lower.includes('.mkv') ||
    lower.includes('.webm')
  );
};

export default function HappeningPlaces() {
  const router = useRouter();
  const { token } = useAuth();
  const [topLocations, setTopLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFixedLine, setShowFixedLine] = useState(false);

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

  // Handle scroll to show/hide fixed line
  const handleScroll = useCallback((event) => {
    const scrollY = event.nativeEvent.contentOffset.y;

    if (scrollY > 100) {
      setShowFixedLine(true);
    } else {
      setShowFixedLine(false);
    }
  }, []);

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
        {/* Fixed Line - Shows only when scrolled */}
        {showFixedLine && (
          <View style={styles.fixedLine} />
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Header Container - Gradient with Premium Finish */}
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
<View style={styles.titleBoxWrapper}>
  <BlurView intensity={60} tint="light" style={styles.titleBox}>
    <Text style={styles.titleMain}>Happening places</Text>
    <View style={styles.subtitleRow}>
      <Ionicons name="location" size={16} color="#E94A37" />
      <Text style={styles.titleSub}>
        Most Visited Places Around you
      </Text>
    </View>
  </BlurView>
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
  const thumbnails = location.thumbnails || [];
  const imagesData = location.images_data || [];

  return (
    <TouchableOpacity
      key={location.location || location.location_name || index}
      style={styles.cardOuter}
      onPress={() => handleLocationPress(location)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['rgba(27, 124, 130, 0.35)', 'rgba(27, 124, 130, 0.15)', 'rgba(255, 255, 255, 1)']}
        locations={[0, 0.3, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <View style={styles.rankNumber}>
            <LinearGradient
              colors={['#E94A37', '#F2CF68', '#1B7C82']}
              start={{ x: 3, y: 3 }}
              end={{ x: 0, y: 3 }}
              style={styles.rankGradient}
            >
              <Text style={styles.rankNumberText}>{index + 1}</Text>
            </LinearGradient>
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationName} numberOfLines={1}>
              {location.location || location.location_name}
            </Text>
            <Text style={styles.uploadCount}>
              ({formatUploadCount(location.uploads)} uploaded)
            </Text>
          </View>
        </View>

        <View style={styles.imageGrid}>
          {images.length > 0 ? (
            <>
              {/* First Row - 3 images */}
              <View style={styles.imageRow}>
                {images.slice(0, 3).map((imageUrl, imgIndex) => {
                  const fixedUrl = fixUrl(imageUrl);
                  const thumbnailUrl = fixUrl(thumbnails[imgIndex]);
                  const imageData = imagesData[imgIndex] || {};
                  const isVideo = isVideoFile(imageUrl) || imageData.media_type === 'video';
                  const userLevel = imageData.user_level || null;
                  const displayUrl = isVideo && thumbnailUrl ? thumbnailUrl : fixedUrl;
                  
                  if (!displayUrl) return null;
                  return (
                    <View key={imgIndex} style={styles.gridImageContainer}>
                      <Image
                        source={{ uri: displayUrl }}
                        style={styles.gridImageSquare}
                        contentFit="cover"
                        placeholder={{ blurhash: BLUR_HASH }}
                        transition={300}
                      />
                      {isVideo && (
                        <View style={styles.videoPlayIcon}>
                          <Ionicons name="play-circle" size={24} color="#fff" />
                        </View>
                      )}
                      {userLevel && (
                        <View style={styles.levelBadgeContainer}>
                          <LevelBadge level={userLevel} size="small" />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Second Row - 2 images */}
              <View style={styles.imageRow}>
                {images[3] && (() => {
                  const fixedUrl = fixUrl(images[3]);
                  const thumbnailUrl = fixUrl(thumbnails[3]);
                  const imageData = imagesData[3] || {};
                  const isVideo = isVideoFile(images[3]) || imageData.media_type === 'video';
                  const userLevel = imageData.user_level || null;
                  const displayUrl = isVideo && thumbnailUrl ? thumbnailUrl : fixedUrl;
                  
                  return (
                    <View style={styles.gridImageContainer}>
                      <Image
                        source={{ uri: displayUrl }}
                        style={styles.gridImageSquare}
                        contentFit="cover"
                        placeholder={{ blurhash: BLUR_HASH }}
                        transition={300}
                      />
                      {isVideo && (
                        <View style={styles.videoPlayIcon}>
                          <Ionicons name="play-circle" size={24} color="#fff" />
                        </View>
                      )}
                      {userLevel && (
                        <View style={styles.levelBadgeContainer}>
                          <LevelBadge level={userLevel} size="small" />
                        </View>
                      )}
                    </View>
                  );
                })()}

                {images.length === 5 ? (() => {
                  const fixedUrl = fixUrl(images[4]);
                  const thumbnailUrl = fixUrl(thumbnails[4]);
                  const imageData = imagesData[4] || {};
                  const isVideo = isVideoFile(images[4]) || imageData.media_type === 'video';
                  const userLevel = imageData.user_level || null;
                  const displayUrl = isVideo && thumbnailUrl ? thumbnailUrl : fixedUrl;
                  
                  return (
                    <View style={styles.gridImageContainer}>
                      <Image
                        source={{ uri: displayUrl }}
                        style={styles.gridImageSquare}
                        contentFit="cover"
                        placeholder={{ blurhash: BLUR_HASH }}
                        transition={300}
                      />
                      {isVideo && (
                        <View style={styles.videoPlayIcon}>
                          <Ionicons name="play-circle" size={24} color="#fff" />
                        </View>
                      )}
                      {userLevel && (
                        <View style={styles.levelBadgeContainer}>
                          <LevelBadge level={userLevel} size="small" />
                        </View>
                      )}
                    </View>
                  );
                })() : images.length > 5 ? (
                  <View style={styles.blurredImageWrapper}>
                    <Image
                      source={{ uri: fixUrl(thumbnails[4]) || fixUrl(images[4]) }}
                      style={styles.gridImageSquare}
                      contentFit="cover"
                      blurRadius={8}
                      placeholder={{ blurhash: BLUR_HASH }}
                    />
                    <View style={styles.countButtonOverlay}>
                      <LinearGradient
                        colors={['#E94A37', '#F2CF68', '#1B7C82']}
                        start={{ x: 3, y: 3 }}
                        end={{ x: 0, y: 3 }}
                        style={styles.countButtonGradientBorder}
                      >
                        <Text style={styles.countButtonText}>
                          +{location.uploads || images.length}
                        </Text>
                      </LinearGradient>
                    </View>
                  </View>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.noImagePlaceholder}>
              <Ionicons name="image-outline" size={32} color="#CCC" />
            </View>
          )}
        </View>
      </LinearGradient>
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
              size={20}
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
              size={20}
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
                size={22}
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
              size={20}
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
              size={20}
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

  // Fixed line below status bar - appears on scroll
  fixedLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },

  /* Header Container */
  headerContainer: {
    marginBottom: -40,
  },

  /* Gradient Header - PREMIUM FINISH */
  gradientHeader: {
    paddingTop: 45,
    paddingBottom: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  headerTitle: {
    fontFamily: 'Lobster',
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 4, height: 6 },
    textShadowRadius: 4,
  },

  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 100,
  },

  titleBoxWrapper: {
  marginHorizontal: 40,
  marginBottom: 16,
  borderRadius: 30,
  overflow: 'hidden',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
},

cardOuter: {
  marginHorizontal: 4,
  marginBottom: 12,
  borderRadius: 15,
  backgroundColor: '#fff',  // Add this - Android needs background for shadows
},
card: {
  borderRadius: 15,
  padding: 20,
  paddingBottom: 24,
  borderWidth: 1,
  borderColor: '#E8E8E8',
  overflow: 'hidden',  // Move it here
},

 titleBox: {
  paddingVertical: 18,
  paddingHorizontal: 30,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  borderWidth: 1,
  borderColor: 'rgba(200, 200, 200, 0.3)',
},
  titleMain: {
  fontSize: 12,
  fontWeight: '600',
  color: '#000',
},

gridImageContainer: {
  flex: 1,
  height: 110,
  borderRadius: 10,
  overflow: 'hidden',
  position: 'relative',
  borderWidth: 0.5,           
  borderColor: '#000',
},
levelBadgeContainer: {
  position: 'absolute',
  bottom: 4,
  left: 4,
  zIndex: 10,
},

videoPlayIcon: {
  position: 'absolute',
  bottom: 6,
  left: 6,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  borderRadius: 14,
  padding: 0,
},

  titleMain: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    fontStyle: 'lobster',
  },
  titleSub: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  subtitleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 6,
},
titleSub: {
  fontSize: 14,
  color: '#666',
  marginLeft: 6,
},
  card: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    paddingVertical: 4,
  },
  rankNumber: {
    width: 20,
    height: 20,
    borderRadius: 12,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rankGradient: {
    width: 26,
    height: 26,
    borderRadius: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  locationInfo: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 10,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 1,
  },
  uploadCount: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    fontWeight: '400',
  },
  imageGrid: {
    marginTop: 8,
  },

  imageRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 8,
  },

  gridImageLarge: {
    width: 80,
    height: 80,
    borderRadius: 8,
    flex: 1,
  },

  gridImageSquare: {
    flex: 1,
    height: 110,
    borderRadius: 10,
  },

  gridImageSmall: {
    width: 100,
    height: 100,
    borderRadius: 12,
    flex: 1,
  },

  blurredImageWrapper: {
    flex: 1,
    height: 110,
    position: 'relative',
    borderRadius: 10,         
    overflow: 'hidden',       
    borderWidth: 0.5,           
    borderColor: '#000',
  },

  countButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },


  countButton: {
    width: 65,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 12,
  },
  countButtonGradientBorder: {
    width: 55,
    height: 30,
    borderRadius: 20,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  countButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },


  noImagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  moreImagesContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },

  moreImagesOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  moreImagesText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },

  blurredImageContainer: {
    width: 70,
    height: 50,
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
    height: 50,
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
    paddingVertical: 12,
    paddingTop: 4,
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
    width: 48,
    height: 48,
    borderRadius: 24,
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