import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { searchUsers, searchLocations } from '../utils/api';
import { normalizeMediaUrl, normalizeProfilePicture } from '../utils/imageUrlFix';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://backend.cofau.com';

export default function SearchScreen() {
  const router = useRouter();
  const { token } = useAuth() as { token: string | null };
  const [searchText, setSearchText] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [locationResults, setLocationResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchText.trim().length > 0) {
      setShowResults(true);
      setLoading(true);
      
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchText.trim());
      }, 300); // 300ms debounce
    } else {
      setShowResults(false);
      setUserResults([]);
      setLocationResults([]);
      setLoading(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText, token]);

  const performSearch = async (query: string) => {
    if (!query || !token) {
      setLoading(false);
      return;
    }

    try {
      // Search both users and locations in parallel
      const [users, locations] = await Promise.all([
        searchUsers(query).catch(() => []),
        searchLocations(query).catch(() => []),
      ]);

      setUserResults(users || []);
      setLocationResults(locations || []);
    } catch (error) {
      console.error('❌ Search error:', error);
      setUserResults([]);
      setLocationResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (userId: string) => {
    setSearchText('');
    setShowResults(false);
    router.push(`/profile?userId=${userId}`);
  };

  const handleLocationPress = (locationName: string) => {
    setSearchText('');
    setShowResults(false);
    router.push(`/location-details?name=${encodeURIComponent(locationName)}`);
  };

  const handlePostPress = (postId: string) => {
    setSearchText('');
    setShowResults(false);
    router.push(`/post-details/${postId}`);
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserPress(item.id)}
      activeOpacity={0.7}
    >
      <UserAvatar
        profilePicture={item.profile_picture}
        username={item.username}
        size={56}
        level={item.level}
        showLevelBadge={true}
        style={{}}
      />
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.userMeta}>
          {item.posts_count} {item.posts_count === 1 ? 'post' : 'posts'}
          {item.followers_count > 0 && ` • ${item.followers_count} followers`}
        </Text>
      </View>
      {item.is_following && (
        <View style={styles.followingBadge}>
          <Text style={styles.followingText}>Following</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderLocationItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleLocationPress(item.name)}
      activeOpacity={0.7}
    >
      <View style={styles.locationHeader}>
        <Ionicons name="location" size={20} color="#4ECDC4" />
        <View style={styles.locationInfo}>
          <Text style={styles.locationName}>{item.name}</Text>
          <Text style={styles.locationMeta}>
            {item.total_posts} {item.total_posts === 1 ? 'post' : 'posts'}
            {item.average_rating > 0 && ` • ⭐ ${item.average_rating}/10`}
          </Text>
        </View>
      </View>
      
      {/* Photo Preview Grid */}
      {item.sample_photos && item.sample_photos.length > 0 && (
        <View style={styles.photoGrid}>
          {item.sample_photos.slice(0, 4).map((photo: any, index: number) => {
            const photoUrl = normalizeMediaUrl(photo.media_url);
            return (
              <TouchableOpacity
                key={index}
                style={styles.photoPreview}
                onPress={() => handlePostPress(photo.post_id)}
                activeOpacity={0.8}
              >
                {photoUrl ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="image-outline" size={24} color="#ccc" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users, locations, restaurants..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
            autoFocus={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchText('');
                setShowResults(false);
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results */}
      {showResults ? (
        <View style={styles.resultsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4dd0e1" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.resultsScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* User Results */}
              {userResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Users</Text>
                  <FlatList
                    data={userResults}
                    renderItem={renderUserItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* Location Results */}
              {locationResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Locations & Restaurants</Text>
                  <FlatList
                    data={locationResults}
                    renderItem={renderLocationItem}
                    keyExtractor={(item, index) => `${item.name}-${index}`}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* No Results */}
              {!loading && userResults.length === 0 && locationResults.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No results found</Text>
                  <Text style={styles.emptySubtext}>
                    Try searching for a username or location
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        /* Default View - Recent/Explore */
      <ScrollView 
          style={styles.defaultScroll}
        showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.defaultContent}
        >
          <View style={styles.defaultContainer}>
            <Ionicons name="search-outline" size={48} color="#ccc" />
            <Text style={styles.defaultText}>Search for users or locations</Text>
            <Text style={styles.defaultSubtext}>
              Find people, restaurants, and places
            </Text>
          </View>
      </ScrollView>
      )}

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
    backgroundColor: '#FFF',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  resultsScroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userMeta: {
    fontSize: 13,
    color: '#999',
  },
  followingBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  followingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  locationItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationInfo: {
    flex: 1,
    marginLeft: 8,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  locationMeta: {
    fontSize: 13,
    color: '#666',
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 4,
  },
  photoPreview: {
    width: (SCREEN_WIDTH - 64) / 4,
    height: (SCREEN_WIDTH - 64) / 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  defaultScroll: {
    flex: 1,
  },
  defaultContent: {
    flex: 1,
  },
  defaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  defaultText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  defaultSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
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
});
